import os
import json
import shutil
import google.generativeai as genai
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from dotenv import load_dotenv
from scraper import scrape_from_file, extract_text_from_pdf, extract_text_from_docx, extract_text_from_pptx
from vector_store import create_vector_db, get_retrievers
from database import (
    init_db, add_scraped_data, get_all_scraped_data, update_scraped_data, delete_scraped_data,
    add_to_memory, get_all_memory_data, update_memory_data, delete_memory_data,
    add_manual_data, get_all_manual_data, update_manual_data, delete_manual_data,
    add_bug_report, get_all_bug_reports, update_bug_report_status, delete_bug_report
)
from werkzeug.utils import secure_filename

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(os.path.join(UPLOADS_DIR, 'bugs'), exist_ok=True)
os.makedirs("db", exist_ok=True)
init_db()

app = Flask(__name__, static_folder='../frontend', static_url_path='/')
model = genai.GenerativeModel(model_name="gemini-2.5-flash")

FAISS_MEMORY_PATH = "db/faiss_index_memory"
FAISS_MANUAL_PATH = "db/faiss_index_manual"
FAISS_SCRAPED_PATH = "db/faiss_index_scraped"

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'pptx'}
ALLOWED_BUG_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_bug_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_BUG_EXTENSIONS

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


@app.route('/api/add_manual_text', methods=['POST'])
def add_manual_text_handler():
    try:
        data = request.json
        title = data.get('title', 'Tanpa Judul')
        content = data.get('content', '')
        if not content.strip():
            return jsonify({"status": "error", "message": "Konten teks tidak boleh kosong."}), 400
        
        source_name = f"manual-text-{title}"
        add_manual_data(source_name=source_name, title=title, content=content)
        return jsonify({"status": "success", "message": "Data teks manual berhasil ditambahkan."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/add_manual_file', methods=['POST'])
def add_manual_file_handler():
    try:
        title = request.form.get('title', '')
        file = request.files.get('file')

        if not file or not allowed_file(file.filename):
            return jsonify({"status": "error", "message": "File tidak valid atau tidak disediakan."}), 400

        filename = secure_filename(file.filename)
        final_title = title if title.strip() else os.path.splitext(filename)[0]
        
        content = ""
        ext = filename.rsplit('.', 1)[1].lower()
        if ext == 'pdf':
            content = extract_text_from_pdf(file.stream)
        elif ext == 'docx':
            content = extract_text_from_docx(file.stream)
        elif ext == 'pptx':
            content = extract_text_from_pptx(file.stream)
        elif ext == 'txt':
            content = file.stream.read().decode('utf-8')
        
        if not content or not content.strip():
            return jsonify({"status": "error", "message": "Gagal mengekstrak teks atau file kosong."}), 500

        source_name = f"manual-file-{filename}"
        add_manual_data(source_name=source_name, title=final_title, content=content)
        return jsonify({"status": "success", "message": f"Konten dari file '{filename}' berhasil ditambahkan."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/save_memory', methods=['POST'])
def save_memory_handler():
    try:
        data = request.json
        question = data.get('question')
        answer = data.get('answer')
        if not question or not answer:
            return jsonify({"status": "error", "message": "Pertanyaan dan jawaban harus diisi."}), 400
        add_to_memory(question, answer)
        return jsonify({"status": "success", "message": "Percakapan berhasil disimpan ke memori."})
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

@app.route('/api/admin_chat', methods=['POST'])
def admin_chat_handler():
    data = request.json
    user_query = data.get('query', '')
    history = data.get('history', [])
    return Response(stream_with_context(generate_response_stream(user_query, history)), mimetype='application/x-ndjson')

def generate_response_stream(user_query, history):
    for thought in generate_response(user_query, history):
        yield json.dumps(thought) + '\n'

def generate_response(user_query, history):
    if not user_query:
        yield {"step": "error", "data": "Query tidak boleh kosong."}
        return
        
    yield {"step": "start", "data": f"Menerima pertanyaan: '{user_query}'"}

    retriever_memory, retriever_manual, retriever_scraped = get_retrievers()
    
    memory_context = ""
    manual_context = ""
    scraped_context = ""
    all_retrieved_docs_info = []

    # TAHAP 1: Cari di Memory Bank
    yield {"step": "memory_search", "data": "Mencari di Memory Bank..."}
    if retriever_memory:
        try:
            docs = retriever_memory.invoke(user_query)
            if docs:
                memory_context = "\n---\n".join([doc.page_content for doc in docs])
                yield {"step": "memory_found", "data": f"{len(docs)} dokumen relevan ditemukan di Memory Bank."}
                all_retrieved_docs_info.extend([{"source": f"[{doc.metadata.get('type')}]", "content": doc.page_content[:150] + "..."} for doc in docs])
            else:
                yield {"step": "memory_not_found", "data": "Tidak ada yang cocok di Memory Bank."}
        except Exception as e:
            yield {"step": "error", "data": f"Error saat mencari di Memory Bank: {e}"}
    else:
        yield {"step": "warning", "data": "Indeks Memory Bank tidak ditemukan."}

    # TAHAP 2: Cari di Data Manual 
    yield {"step": "manual_search", "data": "Mencari di Data Manual..."}
    if retriever_manual:
        try:
            docs = retriever_manual.invoke(user_query)
            if docs:
                manual_context = "\n---\n".join([doc.page_content for doc in docs])
                yield {"step": "manual_found", "data": f"{len(docs)} dokumen relevan ditemukan di Data Manual."}
                all_retrieved_docs_info.extend([{"source": f"[{doc.metadata.get('type')}]", "content": doc.page_content[:150] + "..."} for doc in docs])
            else:
                yield {"step": "manual_not_found", "data": "Tidak ada yang cocok di Data Manual."}
        except Exception as e:
            yield {"step": "error", "data": f"Error saat mencari di Data Manual: {e}"}
    else:
        yield {"step": "warning", "data": "Indeks Data Manual tidak ditemukan."}

    # TAHAP 3: Cari di Data Scraping
    yield {"step": "scrape_search", "data": "Mencari di Data Scraping..."}
    if retriever_scraped:
        try:
            docs = retriever_scraped.invoke(user_query)
            if docs:
                scraped_context = "\n---\n".join([doc.page_content for doc in docs])
                yield {"step": "scrape_found", "data": f"{len(docs)} dokumen relevan ditemukan di Data Scraping."}
                all_retrieved_docs_info.extend([{"source": f"[{doc.metadata.get('type')}]", "content": doc.page_content[:150] + "..."} for doc in docs])
            else:
                yield {"step": "scrape_not_found", "data": "Tidak ada yang cocok di Data Scraping."}
        except Exception as e:
            yield {"step": "error", "data": f"Error saat mencari di Data Scraping: {e}"}
    else:
        yield {"step": "warning", "data": "Indeks Data Scraping tidak ditemukan."}
    
    if all_retrieved_docs_info:
        yield {"step": "retrieved_docs", "data": all_retrieved_docs_info}

    final_verified_information = ""
    if memory_context:
        final_verified_information += f"--- Informasi dari Memory Bank (Gunakan Ini Sebagai Jawaban Utama) ---\n{memory_context}\n\n"
    if manual_context:
        final_verified_information += f"--- Informasi Tambahan dari Data Manual (Prioritas Kedua) ---\n{manual_context}\n\n"
    if scraped_context:
        final_verified_information += f"--- Informasi Tambahan dari Website (Prioritas Terendah) ---\n{scraped_context}"

    if not final_verified_information.strip():
         yield {"step": "warning", "data": "Tidak ada informasi relevan yang dapat ditemukan untuk menyusun jawaban."}

    yield {"step": "final_prompt", "data": "Menyusun jawaban akhir berdasarkan informasi yang ditemukan..."}
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
        
        ## Informasi yang Telah Diverifikasi (Dengan Urutan Prioritas)
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


@app.route('/api/delete_faiss', methods=['POST'])
def delete_faiss_handler():
    try:
        paths = [FAISS_MEMORY_PATH, FAISS_MANUAL_PATH, FAISS_SCRAPED_PATH]
        deleted_count = 0
        for path in paths:
            if os.path.exists(path):
                shutil.rmtree(path)
                deleted_count += 1
        
        if deleted_count > 0:
            os.makedirs("db", exist_ok=True)
            return jsonify({"status": "success", "message": f"Berhasil menghapus {deleted_count} direktori indeks FAISS."})
        else:
            return jsonify({"status": "info", "message": "Tidak ada direktori indeks FAISS yang ditemukan untuk dihapus."})
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
                yield f"BERHASIL: {result['url']} - {result['title']}\n"
            else:
                yield f"DILEWATI/ERROR: {result['url']} - {result['reason']}\n"
    return Response(stream_with_context(generate_logs()), mimetype='text/plain')

@app.route('/api/reindex', methods=['POST'])
def reindex_handler():
    return Response(stream_with_context(create_vector_db()), mimetype='text/plain')

@app.route('/api/get-data', methods=['GET'])
def get_data_handler():
    scraped = get_all_scraped_data()
    manual = get_all_manual_data()
    memory = get_all_memory_data()

    all_data = []
    for item in scraped:
        item['type'] = 'Scrap'
        item['timestamp'] = item['scraped_at']
        all_data.append(item)
        
    for item in manual:
        item['type'] = 'Manual'
        item['timestamp'] = item['added_at']
        item['url'] = item['source_name']
        all_data.append(item)

    for item in memory:
        item['type'] = 'Memory'
        item['timestamp'] = item['saved_at']
        item['title'] = item['question']
        item['content'] = item['answer']
        item['url'] = f"Memory Bank #{item['id']}"
        all_data.append(item)

    all_data_sorted = sorted(all_data, key=lambda x: x['timestamp'], reverse=True)
    return jsonify(all_data_sorted)

@app.route('/api/data/<string:type>/<int:item_id>', methods=['PUT', 'DELETE'])
def update_delete_data_handler(type, item_id):
    try:
        if request.method == 'PUT':
            data = request.json
            if type == 'Scrap':
                update_scraped_data(item_id, data.get('title'), data.get('content'))
            elif type == 'Manual':
                update_manual_data(item_id, data.get('title'), data.get('content'))
            elif type == 'Memory':
                update_memory_data(item_id, data.get('title'), data.get('content'))
            else:
                return jsonify({"status": "error", "message": "Tipe data tidak valid."}), 400
            return jsonify({"status": "success", "message": "Data berhasil diperbarui."})

        elif request.method == 'DELETE':
            if type == 'Scrap':
                delete_scraped_data(item_id)
            elif type == 'Manual':
                delete_manual_data(item_id)
            elif type == 'Memory':
                delete_memory_data(item_id)
            else:
                return jsonify({"status": "error", "message": "Tipe data tidak valid."}), 400
            return jsonify({"status": "success", "message": "Data berhasil dihapus."})
            
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

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