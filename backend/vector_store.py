import os
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
from database import get_all_scraped_data

# --- Konfigurasi ---
FAISS_INDEX_PATH = "db/faiss_index"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def create_vector_db():
    """
    Membuat atau memperbarui vector database (FAISS index) dari data yang ada di database.
    """
    if not GEMINI_API_KEY:
        yield "ERROR: GEMINI_API_KEY tidak ditemukan di environment variables.\n"
        return

    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=GEMINI_API_KEY)
    
    # Langkah 1: Mengambil semua data dari database
    yield "Langkah 1/4: Mengambil semua data dari database...\n"
    try:
        scraped_data = get_all_scraped_data()
        if not scraped_data:
            yield "INFO: Tidak ada data di database untuk di-index.\n"
            return
            
        # Konversi data dari database menjadi format Document LangChain
        all_docs = [
            Document(
                page_content=item['content'] or "", # Pastikan konten tidak None
                metadata={"source": item['url'], "title": item['title']}
            ) for item in scraped_data
        ]
        
    except Exception as e:
        yield f"ERROR saat mengambil data dari database: {e}\n"
        return

    if not all_docs:
        yield "Tidak ada dokumen yang valid untuk di-index.\n"
        return
        
    yield f"Ditemukan total {len(all_docs)} dokumen untuk di-index.\n"

    # Langkah 2: Memecah dokumen menjadi chunks
    yield "Langkah 2/4: Memecah dokumen menjadi chunks...\n"
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    texts = text_splitter.split_documents(all_docs)
    yield f"Dokumen dipecah menjadi {len(texts)} potongan.\n"

    # Langkah 3: Membuat embeddings dan FAISS index
    yield "Langkah 3/4: Membuat embeddings (vektor numerik) dari teks...\n"
    try:
        vector_store = FAISS.from_documents(texts, embeddings)
    except Exception as e:
        yield f"ERROR saat membuat embeddings: Pastikan API Key Anda valid dan memiliki akses ke model embedding. Detail: {e}\n"
        return

    # Langkah 4: Menyimpan FAISS index
    yield "Langkah 4/4: Membuat dan menyimpan FAISS index...\n"
    try:
        vector_store.save_local(FAISS_INDEX_PATH)
        yield "Sukses! FAISS index telah dibuat dan disimpan.\n"
    except Exception as e:
        yield f"ERROR saat menyimpan FAISS index: {e}\n"


def get_retriever(k=4):
    """
    Memuat FAISS index yang ada dan mengembalikannya sebagai retriever.
    """
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY tidak ditemukan.")
        return None
        
    if not os.path.exists(FAISS_INDEX_PATH):
        print("INFO: FAISS index tidak ditemukan. Perlu dibuat terlebih dahulu.")
        return None

    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=GEMINI_API_KEY)
        vector_db = FAISS.load_local(FAISS_INDEX_PATH, embeddings, allow_dangerous_deserialization=True)
        return vector_db.as_retriever(search_kwargs={"k": k})
    except Exception as e:
        print(f"Error saat memuat FAISS index: {e}")
        return None