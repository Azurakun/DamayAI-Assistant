import os
import datetime
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from langchain_core.documents import Document
from dotenv import load_dotenv

load_dotenv()

# Configuration
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "damayai_db")

client = None
db = None

def get_db():
    global client, db
    if db is None:
        if not MONGO_URI:
            raise ValueError("MONGO_URI is not set in .env file")
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
    return db

def init_db():
    """Initializes MongoDB indexes to ensure uniqueness and query performance."""
    database = get_db()
    
    # Collection: scraped_data
    # Constraint: url must be unique
    database.scraped_data.create_index([("url", ASCENDING)], unique=True)
    database.scraped_data.create_index([("scraped_at", DESCENDING)])

    # Collection: manual_data
    # Constraint: source_name must be unique
    database.manual_data.create_index([("source_name", ASCENDING)], unique=True)
    database.manual_data.create_index([("added_at", DESCENDING)])

    # Collection: memory_bank
    # Constraint: question must be unique
    database.memory_bank.create_index([("question", ASCENDING)], unique=True)
    database.memory_bank.create_index([("saved_at", DESCENDING)])

    # Collection: bug_reports
    database.bug_reports.create_index([("reported_at", DESCENDING)])
    
    print(f"MongoDB initialized. Connected to database: {DB_NAME}")

def _format_doc(doc):
    """Helper to convert ObjectId to string and format dates."""
    if not doc:
        return None
    doc['id'] = str(doc['_id'])
    del doc['_id']
    return doc

# --- CRUD FUNCTION: MANUAL DATA ---

def add_manual_data(source_name, title, content, file_path=None):
    database = get_db()
    data = {
        "source_name": source_name,
        "title": title,
        "content": content,
        "added_at": datetime.datetime.utcnow()
    }
    if file_path:
        data["file_path"] = file_path
    try:
        database.manual_data.replace_one(
            {"source_name": source_name}, 
            data, 
            upsert=True
        )
    except Exception as e:
        print(f"Error adding manual data: {e}")

def get_all_manual_data():
    database = get_db()
    cursor = database.manual_data.find().sort("added_at", DESCENDING)
    return [_format_doc(doc) for doc in cursor]

def update_manual_data(item_id, title, content):
    database = get_db()
    database.manual_data.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"title": title, "content": content}}
    )

def delete_manual_data(item_id):
    database = get_db()
    database.manual_data.delete_one({"_id": ObjectId(item_id)})

def get_manual_text_documents_for_indexing():
    database = get_db()
    documents = []
    # Filter documents where file_path does not exist or is null
    cursor = database.manual_data.find({"file_path": {"$exists": False}})
    for doc in cursor:
        page_content = f"Judul Informasi Teks: {doc['title']}\n\nKonten:\n{doc['content']}"
        metadata = {"source": doc['source_name'], "title": doc['title'], "type": "Data Teks"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    return documents

def get_document_documents_for_indexing():
    database = get_db()
    documents = []
    # Filter documents where file_path exists
    cursor = database.manual_data.find({"file_path": {"$exists": True}})
    for doc in cursor:
        page_content = f"Judul Dokumen: {doc['title']}\n\nIsi Dokumen:\n{doc['content']}"
        metadata = {"source": doc['source_name'], "title": doc['title'], "type": "Data Dokumen"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    return documents

# --- CRUD FUNCTION: MEMORY BANK ---

def add_to_memory(question, answer):
    database = get_db()
    data = {
        "question": question,
        "answer": answer,
        "saved_at": datetime.datetime.utcnow()
    }
    try:
        database.memory_bank.replace_one(
            {"question": question},
            data,
            upsert=True
        )
    except Exception as e:
        print(f"Error adding to memory: {e}")

def get_all_memory_data():
    database = get_db()
    cursor = database.memory_bank.find().sort("saved_at", DESCENDING)
    return [_format_doc(doc) for doc in cursor]

def update_memory_data(item_id, question, answer):
    database = get_db()
    database.memory_bank.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"question": question, "answer": answer}}
    )

def delete_memory_data(item_id):
    database = get_db()
    database.memory_bank.delete_one({"_id": ObjectId(item_id)})

def get_memory_documents_for_indexing():
    database = get_db()
    documents = []
    cursor = database.memory_bank.find()
    for doc in cursor:
        page_content = f"Pertanyaan: {doc['question']}\nJawaban Pasti: {doc['answer']}"
        metadata = {"source": f"Memory Bank: {doc['question'][:50]}...", "title": doc['question'], "type": "Memory Bank"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    return documents

# --- CRUD FUNCTION: SCRAPED DATA ---

def add_scraped_data(url, title, content, image_url):
    database = get_db()
    data = {
        "url": url,
        "title": title,
        "content": content,
        "image_url": image_url,
        "scraped_at": datetime.datetime.utcnow()
    }
    try:
        database.scraped_data.replace_one(
            {"url": url},
            data,
            upsert=True
        )
    except Exception as e:
        print(f"Error adding scraped data: {e}")

def get_all_scraped_data():
    database = get_db()
    cursor = database.scraped_data.find().sort("scraped_at", DESCENDING)
    return [_format_doc(doc) for doc in cursor]

def update_scraped_data(item_id, title, content):
    database = get_db()
    database.scraped_data.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"title": title, "content": content}}
    )

def delete_scraped_data(item_id):
    database = get_db()
    database.scraped_data.delete_one({"_id": ObjectId(item_id)})

def get_scraped_documents_for_indexing():
    database = get_db()
    documents = []
    cursor = database.scraped_data.find()
    for doc in cursor:
        image_info = f"URL Gambar Terkait: {doc.get('image_url')}" if doc.get('image_url') else "Tidak ada gambar terkait."
        page_content = f"Judul Halaman: {doc['title']}\nURL: {doc['url']}\n{image_info}\n\nKonten:\n{doc['content']}"
        metadata = {"source": doc['url'], "title": doc['title'], "type": "Data Scrap", "image_url": doc.get('image_url', '')}
        documents.append(Document(page_content=page_content, metadata=metadata))
    return documents

# --- CRUD FUNCTION: BUG REPORTS ---

def add_bug_report(description, file_path):
    database = get_db()
    data = {
        "description": description,
        "file_path": file_path,
        "status": "Baru",
        "reported_at": datetime.datetime.utcnow()
    }
    database.bug_reports.insert_one(data)

def get_all_bug_reports():
    database = get_db()
    cursor = database.bug_reports.find().sort("reported_at", DESCENDING)
    return [_format_doc(doc) for doc in cursor]

def update_bug_report_status(report_id, status):
    database = get_db()
    database.bug_reports.update_one(
        {"_id": ObjectId(report_id)},
        {"$set": {"status": status}}
    )

def delete_bug_report(report_id):
    database = get_db()
    database.bug_reports.delete_one({"_id": ObjectId(report_id)})

def get_bug_report_by_id(report_id):
    database = get_db()
    doc = database.bug_reports.find_one({"_id": ObjectId(report_id)})
    return _format_doc(doc) if doc else None

# --- DASHBOARD STATISTICS ---

def get_dashboard_stats():
    """Returns aggregate counts for dashboard."""
    database = get_db()
    return {
        "scraped_count": database.scraped_data.count_documents({}),
        "manual_count": database.manual_data.count_documents({}),
        "memory_count": database.memory_bank.count_documents({}),
        "bug_count": database.bug_reports.count_documents({}),
        "bug_new": database.bug_reports.count_documents({"status": "Baru"}),
        "bug_processing": database.bug_reports.count_documents({"status": "Sedang Diproses"}),
        "bug_done": database.bug_reports.count_documents({"status": "Selesai"}),
    }

# --- SYSTEM STATS / TOKEN USAGE ---

def add_token_usage(prompt, completion, total):
    database = get_db()
    database.system_stats.update_one(
        {"_id": "token_usage"},
        {"$inc": {"prompt": prompt, "completion": completion, "total": total, "requests": 1}},
        upsert=True
    )

def get_token_usage():
    database = get_db()
    doc = database.system_stats.find_one({"_id": "token_usage"})
    if doc:
        return {
            "prompt": doc.get("prompt", 0), 
            "completion": doc.get("completion", 0), 
            "total": doc.get("total", 0),
            "requests": doc.get("requests", 0)
        }
    return {"prompt": 0, "completion": 0, "total": 0, "requests": 0}

# --- SINGLE ITEM GETTERS ---

def get_scraped_data_by_id(item_id):
    database = get_db()
    doc = database.scraped_data.find_one({"_id": ObjectId(item_id)})
    return _format_doc(doc) if doc else None

def get_manual_data_by_id(item_id):
    database = get_db()
    doc = database.manual_data.find_one({"_id": ObjectId(item_id)})
    return _format_doc(doc) if doc else None

def get_memory_data_by_id(item_id):
    database = get_db()
    doc = database.memory_bank.find_one({"_id": ObjectId(item_id)})
    return _format_doc(doc) if doc else None