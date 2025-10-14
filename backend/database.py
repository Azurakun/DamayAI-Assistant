import sqlite3
from langchain_core.documents import Document

DATABASE_NAME = 'scraped_data.db'

def init_db():
    """Initializes the database and creates tables if they don't exist."""
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
    # Tabel baru untuk memori Q&A
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS memory_bank (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT UNIQUE,
            answer TEXT,
            saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()
    print("Database initialized successfully with all tables.")

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

def search_memory(query):
    """Searches for a relevant answer in the memory bank using simple LIKE matching."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT answer FROM memory_bank WHERE question LIKE ?", ('%' + query + '%',))
    results = cursor.fetchall()
    conn.close()
    if results:
        return "\n---\n".join([row[0] for row in results])
    return None

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

def get_all_documents_for_indexing():
    """Retrieves data formatted as LangChain Documents for indexing."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute('SELECT url, title, content, image_url FROM scraped_data')
    rows = cursor.fetchall()
    conn.close()
    documents = []
    for row in rows:
        url, title, content, image_url = row
        image_info = f"URL Gambar Terkait: {image_url}" if image_url else "Tidak ada gambar terkait."
        page_content = f"Judul Halaman: {title}\nURL: {url}\n{image_info}\n\nKonten:\n{content}"
        metadata = {"source": url, "title": title}
        documents.append(Document(page_content=page_content, metadata=metadata))
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