import os
import json
import shutil
import google.generativeai as genai
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from dotenv import load_dotenv
from scraper import scrape_from_file, extract_text_from_pdf, extract_text_from_docx, extract_text_from_pptx
from vector_store import create_vector_db, get_retriever
from database import init_db, add_scraped_data, get_all_scraped_data, update_data, delete_data, add_to_memory, add_bug_report, get_all_bug_reports, update_bug_report_status, delete_bug_report
from werkzeug.utils import secure_filename

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(os.path.join(UPLOADS_DIR, 'bugs'), exist_ok=True)
os.makedirs("db", exist_ok=True)
init_db()

app = Flask(__name__, static_folder='../frontend', static_url_path='/')
model = genai.GenerativeModel(model_name="gemini-2.5-flash")

# --- Bagian ini berisi semua endpoint API yang sudah ada dan tidak diubah ---
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'pptx'}
ALLOWED_BUG_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_bug_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_BUG_EXTENSIONS

@app.route('/api/report_bug', methods=['POST'])
def report_bug_handler():
    try:
        description = request.form.get('description')
        file = request.files.get('file')
        if not description:
            return jsonify({"status": "error", "message": "Deskripsi masalah harus diisi."}), 400
        file_path = None
        if file and allowed_bug_file(file.filename):
            filename = secure_filename(file.filename)
            relative_path = os.path.join('bugs', filename)
            save_path = os.path.join(UPLOADS_DIR, 'bugs', filename)
            file.save(save_path)
            file_path = relative_path.replace(os.path.sep, '/')
        add_bug_report(description, file_path)
        return jsonify({"status": "success", "message": "Laporan bug berhasil dikirim."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/get_bug_reports', methods=['GET'])
def get_bug_reports_handler():
    reports = get_all_bug_reports()
    return jsonify(reports)

@app.route('/api/bug_reports/<int:report_id>/status', methods=['PUT'])
def update_bug_status_handler(report_id):
    try:
        data = request.json
        new_status = data.get('status')
        if not new_status:
            return jsonify({"status": "error", "message": "Status is required."}), 400
        update_bug_report_status(report_id, new_status)
        return jsonify({"status": "success", "message": f"Bug report {report_id} status updated."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/bug_reports/<int:report_id>', methods=['DELETE'])
def delete_bug_handler(report_id):
    try:
        delete_bug_report(report_id)
        return jsonify({"status": "success", "message": f"Bug report {report_id} deleted."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/add_manual_data', methods=['POST'])
def add_manual_data_handler():
    try:
        title = request.form.get('title', 'Tanpa Judul')
        content = request.form.get('content', '')
        file = request.files.get('file')
        if not content and not file:
            return jsonify({"status": "error", "message": "Konten atau file harus disediakan."}), 400
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            if not title or title == 'Tanpa Judul':
                title = filename
            file_content = ""
            if filename.lower().endswith('.pdf'):
                file_content = extract_text_from_pdf(file.stream)
            elif filename.lower().endswith('.docx'):
                file_content = extract_text_from_docx(file.stream)
            elif filename.lower().endswith('.pptx'):
                file_content = extract_text_from_pptx(file.stream)
            if file_content is None:
                 return jsonify({"status": "error", "message": "Gagal mengekstrak teks dari file."}), 500
            content = f"{content}\n\n--- Isi dari {filename} ---\n{file_content}".strip()
        add_scraped_data(url=f"manual-input-{title}", title=title, content=content, image_url=None)
        return jsonify({"status": "success", "message": "Data berhasil ditambahkan secara manual."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/save_memory', methods=['POST'])
def save_memory_handler():
    try:
        data = request.json
        question = data.get('question')
        answer = data.get('answer')
        if not question or not answer:
            return jsonify({"status": "error", "message": "Question and answer are required."}), 400
        add_to_memory(question, answer)
        return jsonify({"status": "success", "message": "Conversation saved to memory."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat_handler():
    data = request.json
    user_query = data.get('query', '')
    history = data.get('history', [])
    final_answer = "Maaf, terjadi kesalahan saat memproses permintaan Anda."
    for thought in generate_response(user_query, history):
        try:
            if thought.get('step') == 'final_answer':
                final_answer = thought.get('data', final_answer)
        except AttributeError:
            continue
    return jsonify({"response": final_answer})

# --- AKHIR DARI BAGIAN YANG TIDAK DIUBAH ---


@app.route('/api/admin_chat', methods=['POST'])
def admin_chat_handler():
    """Endpoint untuk panel admin yang melakukan streaming proses berpikir."""
    data = request.json
    user_query = data.get('query', '')
    history = data.get('history', [])
    return Response(stream_with_context(generate_response_stream(user_query, history)), mimetype='application/x-ndjson')


def generate_response_stream(user_query, history):
    """Generator baru untuk streaming JSON ke admin panel."""
    for thought in generate_response(user_query, history):
        yield json.dumps(thought) + '\n'


def generate_response(user_query, history):
    """Fungsi utama yang berisi logika AI, dengan pemisahan konteks untuk prioritas."""
    if not user_query:
        yield {"step": "error", "data": "Query is required"}
        return
        
    yield {"step": "start", "data": f"Menerima pertanyaan: '{user_query}'"}

    # Langkah 1: Pencarian Terintegrasi
    retriever = get_retriever()
    memory_context = ""
    scraped_context = ""
    
    if retriever:
        yield {"step": "retrieval", "data": "Mencari dokumen relevan dari seluruh basis data pengetahuan (termasuk Memory Bank)..."}
        try:
            docs = retriever.invoke(user_query)
            
            doc_data = []
            memory_docs_content = []
            scraped_docs_content = []

            for doc in docs:
                source_type = doc.metadata.get('type', 'Data')
                source_info = doc.metadata.get('source', 'N/A')
                doc_label = f"[{source_type}] {source_info}"
                doc_data.append({"source": doc_label, "content": doc.page_content[:150] + "..."})
                
                if source_type == 'Memory Bank':
                    memory_docs_content.append(doc.page_content)
                else:
                    scraped_docs_content.append(doc.page_content)

            if not doc_data:
                yield {"step": "warning", "data": "Tidak ada dokumen relevan yang ditemukan di seluruh basis data."}
            else:
                yield {"step": "retrieved_docs", "data": doc_data}

            memory_context = "\n---\n".join(memory_docs_content)
            scraped_context = "\n---\n".join(scraped_docs_content)

        except Exception as e:
            yield {"step": "error", "data": f"Error saat mengambil dokumen: {e}"}
    else:
        yield {"step": "warning", "data": "Retriever tidak tersedia. Tidak dapat melakukan pencarian."}

    # Langkah 2: Pemisahan Konteks (Eksplisit untuk Log)
    yield {"step": "context_separation", "data": "Memisahkan konteks untuk prioritas..."}
    if memory_context:
        yield {"step": "memory_context_found", "data": "Konteks dari Memory Bank ditemukan dan akan diprioritaskan."}
    if scraped_context:
        yield {"step": "scraped_context_found", "data": "Konteks dari data scraping/manual ditemukan."}

    # Langkah 3: Agent Pemroses Data (Hanya untuk data scraping)
    refined_scraped_context = ""
    if scraped_context.strip():
        yield {"step": "refining", "data": "Agen Pemroses Data sedang mensintesis konteks dari data scraping/manual..."}
        try:
            refiner_prompt = f"Ringkas dan sintesis teks mentah berikut menjadi satu paragraf yang relevan untuk menjawab pertanyaan '{user_query}'. Teks Mentah:\n---\n{scraped_context}\n---\nRingkasan Relevan:"
            refiner_response = model.generate_content(refiner_prompt)
            refined_scraped_context = refiner_response.text
            yield {"step": "refined_context", "data": refined_scraped_context}
        except Exception as e:
            yield {"step": "warning", "data": f"Gagal memurnikan konteks scraping, menggunakan data mentah. Error: {e}"}
            refined_scraped_context = scraped_context
    else:
        yield {"step": "info", "data": "Tidak ada konteks dari data scraping untuk diproses."}

    # Menggabungkan semua konteks untuk prompt final
    final_verified_information = ""
    if memory_context:
        final_verified_information += f"--- Informasi Pasti dari Memory Bank (Prioritas Tertinggi) ---\n{memory_context}\n\n"
    if refined_scraped_context:
        final_verified_information += f"--- Informasi Tambahan dari Dokumen (Scraping/Manual) ---\n{refined_scraped_context}"

    if not final_verified_information.strip():
         yield {"step": "warning", "data": "Tidak ada informasi terverifikasi yang dapat digunakan untuk menyusun jawaban."}

    # Langkah 4: Agent Persona Staf
    yield {"step": "final_prompt", "data": "Agen Persona Staf sedang menyusun jawaban akhir dengan kesadaran konteks..."}
    try:
        final_prompt_text = f"""
        ### PROMPT UTAMA UNTUK AI ###

        # Persona Inti Anda
        Anda adalah DamayAI, asisten digital resmi dari SMKN 2 Indramayu.
        - **Sapaan ke Pengguna**: Selalu panggil pengguna dengan sapaan "Kak".
        - **Gaya Bicara**: Gunakan bahasa Indonesia yang semi-formal, ramah, sopan, jelas, dan mudah dipahami. Hindari bahasa yang terlalu kaku atau teknis, namun tetap profesional. Tunjukkan semangat untuk membantu.
        - **Larangan**: Anda TIDAK PERNAH berspekulasi, memberikan opini pribadi, atau mengarang informasi.

        # Struktur dan Formatting Jawaban Anda
        Untuk memastikan jawaban Anda komprehensif dan mudah dibaca, Anda HARUS menggunakan tag khusus berikut untuk formatting. JANGAN gunakan Markdown (`*`, `**`, `#`, `==`).
        1.  **Pembukaan Ramah**: Mulailah selalu dengan sapaan pembuka yang singkat dan ramah.
        2.  **Judul**: Gunakan tag `[TITLE]Judul Bagian[/TITLE]` untuk membuat judul.
        3.  **Teks Tebal**: Gunakan tag `[B]Teks yang ingin ditebalkan[/B]` untuk membuat teks menjadi tebal.
        4.  **Poin Bernomor**: Mulai setiap item dengan angka diikuti titik (`1.`, `2.`, `3.`). Letakkan setiap item di baris baru.
        5.  **Poin Simbol**: Mulai setiap item dengan tanda hubung (`-`). Letakkan setiap item di baris baru.
        6.  **Paragraf Pendek**: Pecah penjelasan yang panjang menjadi beberapa paragraf pendek dengan memisahkannya menggunakan baris baru.
        7.  **Penutup yang Membantu**: Akhiri jawaban Anda dengan kalimat penutup yang sopan dan menawarkan bantuan lebih lanjut.

        # Aturan Pengolahan Informasi
        1.  **Prioritas Informasi**: Informasi dari "Memory Bank" adalah fakta utama dan paling akurat. Integrasikan informasi ini sebagai inti jawaban Anda. Gunakan "Informasi Tambahan dari Dokumen" untuk memberikan detail, konteks, atau penjelasan yang lebih lengkap.
        2.  **Kejujuran**: Jika informasi yang ditanyakan tidak ada dalam konteks yang diberikan, sampaikan dengan jujur dan sopan. Contoh: "Mohon maaf Kak, untuk informasi spesifik mengenai hal tersebut saat ini belum saya ketahui."
        3.  **Penggunaan Gambar**: Anda BOLEH menyertakan tag `[IMAGE: url_gambar_disini]`.
        4.  **Sumber Informasi**: JANGAN PERNAH mengatakan frasa seperti "berdasarkan informasi yang saya terima", "menurut konteks", atau "berdasarkan dokumen". Sampaikan informasi seolah-olah Anda sudah mengetahuinya sebagai asisten resmi sekolah.

        ---
        # DATA YANG HARUS ANDA OLAH
        
        ## Informasi yang Telah Diverifikasi
        {final_verified_information}
        
        ## Riwayat Percakapan Sebelumnya
        {history}
        
        ## Pertanyaan Terbaru dari Pengguna
        "{user_query}"
        ---
        
        Jawaban Anda (sebagai DamayAI, ikuti SEMUA aturan formatting dengan tag `[TITLE]` dan `[B]`):
        """
        
        chat_session = model.start_chat(history=history)
        final_response = chat_session.send_message(final_prompt_text)
        
        yield {"step": "final_answer", "data": final_response.text}
    except Exception as e:
        yield {"step": "error", "data": f"Gagal menghasilkan jawaban akhir. Error: {e}"}


# --- Bagian ini berisi sisa endpoint API yang sudah ada dan tidak diubah ---
@app.route('/api/delete_faiss', methods=['POST'])
def delete_faiss_handler():
    try:
        path = 'db/faiss_index'
        if os.path.exists(path):
            shutil.rmtree(path)
            os.makedirs("db", exist_ok=True)
            return jsonify({"status": "success", "message": "Direktori FAISS index berhasil dihapus."})
        else:
            return jsonify({"status": "info", "message": "FAISS index tidak ditemukan."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/delete_db', methods=['POST'])
def delete_db_handler():
    try:
        path = 'scraped_data.db'
        if os.path.exists(path):
            os.remove(path)
            init_db()
            return jsonify({"status": "success", "message": "File database berhasil dihapus dan dibuat ulang."})
        else:
            return jsonify({"status": "info", "message": "File database tidak ditemukan."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/scrape', methods=['POST'])
def scrape_handler():
    def generate_logs():
        urls_file = 'urls_to_scrape.txt'
        yield f"Membaca file '{urls_file}'...\n"
        for result in scrape_from_file(urls_file):
            if result['status'] == 'success':
                add_scraped_data(result['url'], result['title'], result['content'], result.get('image_url'))
                yield f"SUCCESS: {result['url']} - {result['title']}\n"
            elif result['status'] == 'info':
                yield f"INFO: {result['message']}\n"
            else:
                yield f"SKIPPED/ERROR: {result['url']} - {result['reason']}\n"
    return Response(stream_with_context(generate_logs()), mimetype='text/plain')

@app.route('/api/reindex', methods=['POST'])
def reindex_handler():
    return Response(stream_with_context(create_vector_db()), mimetype='text/plain')

@app.route('/api/get-scraped-data', methods=['GET'])
def get_data_handler():
    data = get_all_scraped_data()
    return jsonify(data)

@app.route('/api/data/<int:item_id>', methods=['PUT'])
def update_data_handler(item_id):
    data = request.json
    update_data(item_id, data.get('title'), data.get('content'))
    return jsonify({"status": "success"})

@app.route('/api/data/<int:item_id>', methods=['DELETE'])
def delete_data_handler(item_id):
    delete_data(item_id)
    return jsonify({"status": "success"})

@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/admin')
def serve_admin():
    return send_from_directory('../frontend', 'admin.html')

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOADS_DIR, filename)
    
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)