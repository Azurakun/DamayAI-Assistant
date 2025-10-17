import sqlite3
from langchain_core.documents import Document

DATABASE_NAME = 'scraped_data.db'

def init_db():
    """Menginisialisasi database dan membuat atau memperbarui semua tabel yang diperlukan."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scraped_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE,
            title TEXT,
            content TEXT,
            image_url TEXT,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS manual_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_name TEXT UNIQUE,
            title TEXT,
            content TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS memory_bank (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT UNIQUE,
            answer TEXT,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bug_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            file_path TEXT,
            status TEXT NOT NULL DEFAULT 'Baru',
            reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    try:
        cursor.execute("PRAGMA table_info(bug_reports)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'status' not in columns:
            cursor.execute("ALTER TABLE bug_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'Baru'")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

# --- FUNGSI CRUD DATA MANUAL ---
def add_manual_data(source_name, title, content):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO manual_data (source_name, title, content)
        VALUES (?, ?, ?)
    ''', (source_name, title, content))
    conn.commit()
    conn.close()

def get_all_manual_data():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT id, source_name, title, content, added_at FROM manual_data ORDER BY added_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_manual_data(item_id, title, content):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('UPDATE manual_data SET title = ?, content = ? WHERE id = ?', (title, content, item_id))
    conn.commit()
    conn.close()

def delete_manual_data(item_id):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM manual_data WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()

def get_manual_documents_for_indexing():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    documents = []
    cursor.execute('SELECT source_name, title, content FROM manual_data')
    rows = cursor.fetchall()
    for row in rows:
        source_name, title, content = row
        page_content = f"Judul Informasi Manual: {title}\n\nKonten:\n{content}"
        metadata = {"source": source_name, "title": title, "type": "Data Manual"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    conn.close()
    return documents

# --- FUNGSI CRUD MEMORY BANK ---
def add_to_memory(question, answer):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO memory_bank (question, answer) VALUES (?, ?)', (question, answer))
    conn.commit()
    conn.close()

def get_all_memory_data():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT id, question, answer, saved_at FROM memory_bank ORDER BY saved_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_memory_data(item_id, question, answer):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('UPDATE memory_bank SET question = ?, answer = ? WHERE id = ?', (question, answer, item_id))
    conn.commit()
    conn.close()

def delete_memory_data(item_id):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM memory_bank WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()

def get_memory_documents_for_indexing():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    documents = []
    cursor.execute('SELECT question, answer FROM memory_bank')
    rows = cursor.fetchall()
    for row in rows:
        question, answer = row
        page_content = f"Pertanyaan: {question}\nJawaban Pasti: {answer}"
        metadata = {"source": f"Memory Bank: {question[:50]}...", "title": question, "type": "Memory Bank"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    conn.close()
    return documents

# --- FUNGSI CRUD DATA SCRAPING ---
def add_scraped_data(url, title, content, image_url):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('INSERT OR REPLACE INTO scraped_data (url, title, content, image_url) VALUES (?, ?, ?, ?)', (url, title, content, image_url))
    conn.commit()
    conn.close()

def get_all_scraped_data():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT id, url, title, content, image_url, scraped_at FROM scraped_data ORDER BY scraped_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_scraped_data(item_id, title, content):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('UPDATE scraped_data SET title = ?, content = ? WHERE id = ?', (title, content, item_id))
    conn.commit()
    conn.close()

def delete_scraped_data(item_id):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM scraped_data WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()

def get_scraped_documents_for_indexing():
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    documents = []
    cursor.execute('SELECT url, title, content, image_url FROM scraped_data')
    rows = cursor.fetchall()
    for row in rows:
        url, title, content, image_url = row
        image_info = f"URL Gambar Terkait: {image_url}" if image_url else "Tidak ada gambar terkait."
        page_content = f"Judul Halaman: {title}\nURL: {url}\n{image_info}\n\nKonten:\n{content}"
        metadata = {"source": url, "title": title, "type": "Data Scrap"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    conn.close()
    return documents

# --- FUNGSI LAPORAN BUG (TIDAK BERUBAH) ---
def add_bug_report(description, file_path):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO bug_reports (description, file_path) VALUES (?, ?)', (description, file_path))
    conn.commit()
    conn.close()

def get_all_bug_reports():
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT id, description, file_path, status, reported_at FROM bug_reports ORDER BY reported_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_bug_report_status(report_id, status):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('UPDATE bug_reports SET status = ? WHERE id = ?', (status, report_id))
    conn.commit()
    conn.close()

def delete_bug_report(report_id):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM bug_reports WHERE id = ?', (report_id,))
    conn.commit()
    conn.close()