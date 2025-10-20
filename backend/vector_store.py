import os
import shutil
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from database import get_memory_documents_for_indexing, get_manual_documents_for_indexing, get_scraped_documents_for_indexing

# --- Konfigurasi Path untuk Tiga Indeks Terpisah ---
FAISS_MEMORY_PATH = "db/faiss_index_memory"
FAISS_MANUAL_PATH = "db/faiss_index_manual"
FAISS_SCRAPED_PATH = "db/faiss_index_scraped"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def _create_specific_index(documents, index_path, data_name, embeddings):
    """Fungsi helper untuk membuat satu indeks spesifik."""
    if os.path.exists(index_path):
        shutil.rmtree(index_path)
        yield f"INFO: Direktori indeks lama untuk '{data_name}' di '{index_path}' telah dihapus.\n"
        
    if not documents:
        yield f"INFO: Tidak ada data di '{data_name}' untuk diindeks. Melewati.\n"
        return

    yield f"Memulai proses indexing untuk '{data_name}' ({len(documents)} dokumen)...\n"
    
    # Memecah dokumen menjadi chunks
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    texts = text_splitter.split_documents(documents)
    yield f"Langkah 1/2: '{data_name}' dipecah menjadi {len(texts)} potongan.\n"

    # Membuat embeddings dan menyimpan indeks
    try:
        vector_store = FAISS.from_documents(texts, embeddings)
        vector_store.save_local(index_path)
        yield f"Langkah 2/2: Indeks '{data_name}' berhasil dibuat dan disimpan di '{index_path}'.\n"
    except Exception as e:
        yield f"ERROR saat membuat indeks '{data_name}': {e}\n"

def create_vector_db():
    """Membuat atau memperbarui tiga vector store terpisah untuk semua tipe data."""
    if not GEMINI_API_KEY:
        yield "ERROR: GEMINI_API_KEY tidak ditemukan. Proses dihentikan.\n"
        return

    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=GEMINI_API_KEY)

    # 1. Proses Indeks untuk Memory Bank
    yield "\n--- MEMPROSES MEMORY BANK ---\n"
    memory_docs = get_memory_documents_for_indexing()
    yield from _create_specific_index(memory_docs, FAISS_MEMORY_PATH, "Memory Bank", embeddings)

    # 2. Proses Indeks untuk Data Manual
    yield "\n--- MEMPROSES DATA MANUAL ---\n"
    manual_docs = get_manual_documents_for_indexing()
    yield from _create_specific_index(manual_docs, FAISS_MANUAL_PATH, "Data Manual", embeddings)

    # 3. Proses Indeks untuk Data Scraping
    yield "\n--- MEMPROSES DATA SCRAPING ---\n"
    scraped_docs = get_scraped_documents_for_indexing()
    yield from _create_specific_index(scraped_docs, FAISS_SCRAPED_PATH, "Data Scraping", embeddings)
    
    yield "\nSemua proses indexing selesai.\n"


def get_retrievers(k=2):
    """Memuat semua indeks FAISS yang ada dan mengembalikannya sebagai tiga retriever terpisah."""
    if not GEMINI_API_KEY:
        print("ERROR: GEMINI_API_KEY tidak ditemukan.")
        return None, None, None

    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=GEMINI_API_KEY)
    
    retriever_memory, retriever_manual, retriever_scraped = None, None, None

    # Muat Indeks Memory
    if os.path.exists(FAISS_MEMORY_PATH):
        try:
            db_memory = FAISS.load_local(FAISS_MEMORY_PATH, embeddings, allow_dangerous_deserialization=True)
            retriever_memory = db_memory.as_retriever(search_kwargs={"k": k})
        except Exception as e:
            print(f"Peringatan: Gagal memuat indeks Memory Bank: {e}")

    # Muat Indeks Manual
    if os.path.exists(FAISS_MANUAL_PATH):
        try:
            db_manual = FAISS.load_local(FAISS_MANUAL_PATH, embeddings, allow_dangerous_deserialization=True)
            retriever_manual = db_manual.as_retriever(search_kwargs={"k": k})
        except Exception as e:
            print(f"Peringatan: Gagal memuat indeks Data Manual: {e}")
            
    # Muat Indeks Scraped
    if os.path.exists(FAISS_SCRAPED_PATH):
        try:
            db_scraped = FAISS.load_local(FAISS_SCRAPED_PATH, embeddings, allow_dangerous_deserialization=True)
            retriever_scraped = db_scraped.as_retriever(search_kwargs={"k": k})
        except Exception as e:
            print(f"Peringatan: Gagal memuat indeks Data Scraping: {e}")
            
    return retriever_memory, retriever_manual, retriever_scraped