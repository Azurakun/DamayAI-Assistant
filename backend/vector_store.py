import os
import sys
import logging
from langchain.retrievers.multi_query import MultiQueryRetriever
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader, TextLoader, Docx2txtLoader
from database import get_all_documents_for_indexing

# Set up logging to see the generated queries
logging.basicConfig()
logging.getLogger("langchain.retrievers.multi_query").setLevel(logging.INFO)

DB_FAISS_PATH = 'db/faiss_index'

def get_retriever():
    """
    Creates and returns a MultiQueryRetriever for more effective document retrieval.
    """
    if not os.path.exists(DB_FAISS_PATH):
        print("Vector store not found. Please run indexing from the admin panel.")
        return None

    try:
        api_key = os.getenv("GEMINI_API_KEY")
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=api_key)
        db = FAISS.load_local(DB_FAISS_PATH, embeddings, allow_dangerous_deserialization=True)
        
        llm = ChatGoogleGenerativeAI(temperature=0, google_api_key=api_key, model="gemini-2.5-pro")
        
        retriever = MultiQueryRetriever.from_llm(
            retriever=db.as_retriever(search_kwargs={"k": 7}), llm=llm
        )
        return retriever
        
    except Exception as e:
        print(f"Error creating retriever: {e}")
        return None

def create_vector_db():
    """Creates a vector database from data in the SQLite DB and local files."""
    yield "Langkah 1/5: Mengambil data dari database...\n"
    documents = get_all_documents_for_indexing()
    
    yield "Langkah 2/5: Memuat file lokal dari folder /uploads...\n"
    try:
        loader_pdf = DirectoryLoader('uploads/', glob='**/*.pdf', loader_cls=PyPDFLoader)
        documents.extend(loader_pdf.load())
        
        loader_txt = DirectoryLoader('uploads/', glob='**/*.txt', loader_cls=TextLoader)
        documents.extend(loader_txt.load())
        
        loader_docx = DirectoryLoader('uploads/', glob='**/*.docx', loader_cls=Docx2txtLoader)
        documents.extend(loader_docx.load())
    except Exception as e:
        yield f"Peringatan: Gagal memuat file lokal. Error: {e}\n"

    if not documents:
        yield "Error: Tidak ada dokumen yang ditemukan. Index tidak dibuat.\n"
        return

    yield f"Ditemukan total {len(documents)} dokumen untuk di-index.\n"
    
    yield "Langkah 3/5: Memecah dokumen menjadi chunks...\n"
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    texts = text_splitter.split_documents(documents)

    if not texts:
        yield "Error: Dokumen tidak dapat dipecah. Index tidak dibuat.\n"
        return
    yield f"Dokumen dipecah menjadi {len(texts)} potongan.\n"

    yield "Langkah 4/5: Membuat embeddings (vektor numerik) dari teks...\n"
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            yield "FATAL ERROR: GEMINI_API_KEY tidak ditemukan di file .env. Mohon periksa kembali.\n"
            return
            
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/embedding-001", 
            google_api_key=api_key
        )
        
        yield "Langkah 5/5: Membuat dan menyimpan FAISS index...\n"
        db = FAISS.from_documents(texts, embeddings)
        db.save_local(DB_FAISS_PATH)

    except Exception as e:
        yield f"FATAL ERROR: Gagal saat membuat embeddings atau menyimpan index. Error: {e}\n"
        import traceback
        traceback.print_exc(file=sys.stdout)
        return

    yield "Sukses! FAISS index telah dibuat dan disimpan.\n"