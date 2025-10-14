import os
import json
import shutil
import google.generativeai as genai
from flask import Flask, request, jsonify, Response, stream_with_context, send_from_directory
from dotenv import load_dotenv
from scraper import scrape_from_file, extract_text_from_pdf, extract_text_from_docx, extract_text_from_pptx
from vector_store import create_vector_db, get_retriever
from database import init_db, add_scraped_data, get_all_scraped_data, update_data, delete_data, add_to_memory, search_memory
from werkzeug.utils import secure_filename

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

os.makedirs("uploads", exist_ok=True)
os.makedirs("db", exist_ok=True)
init_db()

app = Flask(__name__, static_folder='../frontend', static_url_path='/')
model = genai.GenerativeModel(model_name="gemini-2.5-pro")

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx', 'pptx'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/add_manual_data', methods=['POST'])
def add_manual_data_handler():
    try:
        title = request.form.get('title', 'Tanpa Judul')
        content = request.form.get('content', '')
        file = request.files.get('file')

        if not content and not file:
            return jsonify({"status": "error", "message": "Konten atau file harus disediakan."}), 400

        # Jika ada file, proses file tersebut
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Jika judul tidak diisi, gunakan nama file sebagai judul
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

            # Gabungkan konten dari form dengan konten dari file
            content = f"{content}\n\n--- Isi dari {filename} ---\n{file_content}".strip()
        
        # Tambahkan ke database
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
    """Endpoint untuk chat publik, tanpa streaming proses berpikir."""
    data = request.json
    user_query = data.get('query', '')
    history = data.get('history', [])
    
    final_answer = "Maaf, terjadi kesalahan saat memproses permintaan Anda."
    
    # Memanggil generator dan hanya mengambil jawaban akhir
    for thought in generate_response(user_query, history):
        try:
            if thought.get('step') == 'final_answer':
                final_answer = thought.get('data', final_answer)
        except AttributeError:
            continue
            
    return jsonify({"response": final_answer})


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
    """Fungsi utama yang berisi logika AI, sekarang menerima history."""
    if not user_query:
        yield {"step": "error", "data": "Query is required"}
        return
        
    yield {"step": "start", "data": f"Menerima pertanyaan: '{user_query}'"}

    # Langkah 0 - Cari di Memory Bank
    yield {"step": "memory_search", "data": "Mencari jawaban di Memory Bank..."}
    memory_context = search_memory(user_query)
    if memory_context:
        yield {"step": "memory_found", "data": memory_context}
    else:
        yield {"step": "memory_not_found", "data": "Tidak ada jawaban yang cocok di Memory Bank."}

    # Langkah 1 & 2: Dapatkan retriever dan ambil dokumen
    retriever = get_retriever()
    raw_doc_context = ""
    if retriever:
        yield {"step": "retrieval", "data": "Mencari dokumen relevan dari hasil scraping..."}
        try:
            docs = retriever.invoke(user_query)
            raw_doc_context = "\n---\n".join([doc.page_content for doc in docs])
            doc_data = [{"source": doc.metadata.get('source', 'N/A'), "content": doc.page_content[:150] + "..."} for doc in docs]
            if not doc_data:
                 yield {"step": "warning", "data": "Tidak ada dokumen relevan yang ditemukan."}
            else:
                yield {"step": "retrieved_docs", "data": doc_data}
        except Exception as e:
            yield {"step": "error", "data": f"Error saat mengambil dokumen: {e}"}
    
    combined_raw_context = (f"Konteks dari Memori:\n{memory_context}\n\n" if memory_context else "") + raw_doc_context

    # Langkah 3: Agent Pemroses Data
    yield {"step": "refining", "data": "Agen Pemroses Data sedang mensintesis semua konteks..."}
    refined_context = ""
    if combined_raw_context.strip():
        try:
            refiner_prompt = f"Ringkas teks mentah berikut menjadi satu paragraf yang relevan dengan pertanyaan '{user_query}'. Teks Mentah:\n---\n{combined_raw_context}\n---\nRingkasan Relevan:"
            refiner_response = model.generate_content(refiner_prompt)
            refined_context = refiner_response.text
            yield {"step": "refined_context", "data": refined_context}
        except Exception as e:
            yield {"step": "warning", "data": f"Gagal memurnikan konteks, menggunakan data mentah. Error: {e}"}
            refined_context = combined_raw_context
    else:
        yield {"step": "warning", "data": "Tidak ada konteks yang bisa diproses."}

    # Langkah 4: Agent Persona Staf
    yield {"step": "final_prompt", "data": "Agen Persona Staf sedang menyusun jawaban akhir dengan kesadaran konteks..."}
    try:
        final_prompt_text = f"""
        Persona Anda: Anda adalah asisten digital SMKN 2 Indramayu. Panggil pengguna dengan sapaan seperti "Kak" jika sesuai.
        
        Gaya Bicara Anda: Gunakan bahasa semi-formal yang ramah, sopan, dan mudah dipahami. Hindari bahasa yang terlalu kaku atau teknis, namun tetap profesional. Anda selalu bersemangat untuk membantu. Anda TIDAK PERNAH berspekulasi atau memberikan opini pribadi.

        Aturan Baru:
        - Selalu berikan jawaban yang informatif dan selengkap mungkin, jangan hanya satu kalimat singkat.
        - Jika memungkinkan, gunakan daftar bernomor agar penjelasan lebih terstruktur dan mudah dibaca.
        - Perhatikan "Riwayat Percakapan Sebelumnya" untuk memberikan respons yang nyambung dengan diskusi yang sedang berjalan.
        - hindari Menggunakan ** untuk formatting dalam jawaban anda

        Aturan Penting Lainnya:
        1.  Informasi dari "Informasi yang Telah Diverifikasi" adalah prioritas utama Anda.
        2.  Jika informasi yang ditanyakan tidak Anda ketahui, sampaikan dengan jujur dan sopan. Contoh: "Mohon maaf, untuk informasi tersebut saat ini belum saya ketahui."
        3.  Jika ada URL gambar yang relevan di informasi, Anda BOLEH menyertakan tag `[IMAGE: url_gambar_disini]`.
        4.  Jangan pernah bilang "berdasarkan informasi yang saya terima" atau "berdasarkan konteks". Berbicaralah seolah-olah Anda memang sudah tahu informasinya.

        Informasi yang Telah Diverifikasi:
        ---
        {refined_context}
        ---

        Riwayat Percakapan Sebelumnya:
        {history}

        Pertanyaan Terbaru dari Pengguna: "{user_query}"

        Jawaban Anda (sebagai Asisten Digital SMKN 2 Indramayu):
        """
        
        chat_session = model.start_chat(history=history)
        final_response = chat_session.send_message(final_prompt_text)
        
        yield {"step": "final_answer", "data": final_response.text}
    except Exception as e:
        yield {"step": "error", "data": f"Gagal menghasilkan jawaban akhir. Error: {e}"}


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
    
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)