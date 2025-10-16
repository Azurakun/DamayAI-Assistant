import sqlite3
from langchain_core.documents import Document

DATABASE_NAME = 'scraped_data.db'

def init_db():
    """Initializes the database and creates or updates tables."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    # Tabel untuk data hasil scraping
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
    # Tabel untuk memori Q&A
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS memory_bank (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT UNIQUE,
            answer TEXT,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Tabel untuk laporan bug
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bug_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            file_path TEXT,
            status TEXT NOT NULL DEFAULT 'Baru',
            reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # --- Schema Migration for bug_reports table ---
    try:
        cursor.execute("PRAGMA table_info(bug_reports)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'status' not in columns:
            cursor.execute("ALTER TABLE bug_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'Baru'")
            print("Database schema updated: Added 'status' column to 'bug_reports' table.")
        if 'issue' in columns and 'description' not in columns:
            cursor.execute('ALTER TABLE bug_reports RENAME COLUMN issue TO description;')
            print("Database schema updated: Renamed 'issue' column to 'description' in 'bug_reports' table.")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()
    print("Database initialized successfully with all tables.")


def add_bug_report(description, file_path):
    """Adds a bug report to the database."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO bug_reports (description, file_path)
        VALUES (?, ?)
    ''', (description, file_path))
    conn.commit()
    conn.close()

def get_all_bug_reports():
    """Retrieves all bug reports."""
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT id, description, file_path, status, reported_at FROM bug_reports ORDER BY reported_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def update_bug_report_status(report_id, status):
    """Updates the status of a specific bug report."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('UPDATE bug_reports SET status = ? WHERE id = ?', (status, report_id))
    conn.commit()
    conn.close()

def delete_bug_report(report_id):
    """Deletes a specific bug report by its ID."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM bug_reports WHERE id = ?', (report_id,))
    conn.commit()
    conn.close()

def add_to_memory(question, answer):
    """Adds or replaces a Q&A pair in the memory bank."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO memory_bank (question, answer)
        VALUES (?, ?)
    ''', (question, answer))
    conn.commit()
    conn.close()

def add_scraped_data(url, title, content, image_url):
    """Adds or replaces scraped data in the database."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO scraped_data (url, title, content, image_url)
        VALUES (?, ?, ?, ?)
    ''', (url, title, content, image_url))
    conn.commit()
    conn.close()

def get_all_scraped_data():
    """Retrieves all scraped data for display."""
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT id, url, title, content, image_url, scraped_at FROM scraped_data ORDER BY scraped_at DESC')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_scraped_documents_for_indexing():
    """Mengambil data dari scraped_data untuk diindeks."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    documents = []
    cursor.execute('SELECT url, title, content, image_url FROM scraped_data')
    rows = cursor.fetchall()
    for row in rows:
        url, title, content, image_url = row
        image_info = f"URL Gambar Terkait: {image_url}" if image_url else "Tidak ada gambar terkait."
        page_content = f"Judul Halaman: {title}\nURL: {url}\n{image_info}\n\nKonten:\n{content}"
        metadata = {"source": url, "title": title, "type": "Scraped Data"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    conn.close()
    return documents

def get_memory_documents_for_indexing():
    """Mengambil data dari memory_bank untuk diindeks."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    documents = []
    cursor.execute('SELECT question, answer FROM memory_bank')
    rows = cursor.fetchall()
    for row in rows:
        question, answer = row
        page_content = f"Pertanyaan yang Sering Diajukan (dari Memori Latihan):\nPertanyaan: {question}\nJawaban Pasti: {answer}"
        metadata = {"source": f"Memori Latihan: {question[:50]}...", "title": question, "type": "Memory Bank"}
        documents.append(Document(page_content=page_content, metadata=metadata))
    conn.close()
    return documents

def update_data(item_id, title, content):
    """Updates a specific data item by its ID."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('UPDATE scraped_data SET title = ?, content = ? WHERE id = ?', (title, content, item_id))
    conn.commit()
    conn.close()

def delete_data(item_id):
    """Deletes a specific data item by its ID."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM scraped_data WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()