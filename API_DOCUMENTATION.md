# API Documentation - DamayAI Assistant

## Overview
**Project**: DamayAI - Digital Receptionist for SMKN 2 Indramayu  
**Framework**: Flask (Python)  
**Database**: MongoDB  
**Total Endpoints**: 23 API Endpoints

---

## API Endpoints Table

| No | Modul | Endpoint (API) | Method | Deskripsi |
|----|-------|----------------|--------|-----------|
| 1 | Health | `/api/health` | GET | Memeriksa status kesehatan API dan koneksi database |
| 2 | Authentication | `/api/admin/login` | POST | Melakukan login admin dan mengembalikan CSRF token |
| 3 | Authentication | `/api/admin/logout` | POST | Melakukan logout admin dan menghapus session |
| 4 | Authentication | `/api/csrf-token` | GET | Mengambil CSRF token untuk request yang memerlukan validasi CSRF |
| 5 | Dashboard | `/api/dashboard/stats` | GET | Mengambil statistik dashboard (jumlah data scraped, manual, memory, bug reports) |
| 6 | Chatbot | `/api/chat` | POST | Endpoint chatbot publik untuk pengguna umum (rate limited: 10/menit) |
| 7 | Chatbot | `/api/admin_chat` | POST | Endpoint chatbot admin dengan streaming response (rate limited: 10/menit) |
| 8 | Scraped Data | `/api/scraped-data` | GET | Mengambil daftar seluruh data hasil scraping website |
| 9 | Scraped Data | `/api/scraped-data/{id}` | GET | Mengambil detail data scraped berdasarkan ID |
| 10 | Scraped Data | `/api/scraped-data/{id}` | PUT | Memperbarui data scraped berdasarkan ID |
| 11 | Scraped Data | `/api/scraped-data/{id}` | DELETE | Menghapus data scraped berdasarkan ID |
| 12 | Manual Data | `/api/manual-data` | GET | Mengambil daftar seluruh data manual yang diupload |
| 13 | Manual Data | `/api/manual-data/{id}` | GET | Mengambil detail data manual berdasarkan ID |
| 14 | Manual Data | `/api/manual-data/{id}` | PUT | Memperbarui data manual berdasarkan ID |
| 15 | Manual Data | `/api/manual-data/{id}` | DELETE | Menghapus data manual berdasarkan ID |
| 16 | Manual Data | `/api/add_manual_text` | POST | Menambahkan data manual berupa teks |
| 17 | Manual Data | `/api/add_manual_file` | POST | Menambahkan data manual berupa file (PDF, DOCX, PPTX, TXT) |
| 18 | Memory Bank | `/api/memory-data` | GET | Mengambil daftar seluruh data memory bank |
| 19 | Memory Bank | `/api/memory-data/{id}` | GET | Mengambil detail data memory berdasarkan ID |
| 20 | Memory Bank | `/api/memory-data/{id}` | PUT | Memperbarui data memory berdasarkan ID |
| 21 | Memory Bank | `/api/memory-data/{id}` | DELETE | Menghapus data memory berdasarkan ID |
| 22 | Memory Bank | `/api/save_memory` | POST | Menyimpan percakapan question-answer ke memory bank |
| 23 | Bug Reports | `/api/report_bug` | POST | Mengirim laporan bug dari pengguna (rate limited: 3/menit) |
| 24 | Bug Reports | `/api/get_bug_reports` | GET | Mengambil daftar seluruh laporan bug |
| 25 | Bug Reports | `/api/bug_reports/{id}` | GET | Mengambil detail laporan bug berdasarkan ID |
| 26 | Bug Reports | `/api/bug_reports/{id}/status` | PUT | Memperbarui status laporan bug (Baru, Sedang Diproses, Selesai, Tidak Akan Diperbaiki) |
| 27 | Bug Reports | `/api/bug_reports/{id}` | DELETE | Menghapus laporan bug berdasarkan ID |
| 28 | Data Management | `/api/get-data` | GET | Mengambil semua data (scraped, manual, memory) dalam satu endpoint |
| 29 | Data Management | `/api/data/{type}/{id}` | PUT | Memperbarui data berdasarkan tipe (Scrap/Manual/Memory) dan ID |
| 30 | Data Management | `/api/data/{type}/{id}` | DELETE | Menghapus data berdasarkan tipe (Scrap/Manual/Memory) dan ID |
| 31 | System | `/api/scrape` | POST | Melakukan scraping URL dari file urls_to_scrape.txt (rate limited: 1/menit) |
| 32 | System | `/api/crawl` | POST | Melakukan deep crawling website dengan base URL dan max_pages (rate limited: 1/menit) |
| 33 | System | `/api/reindex` | POST | Membangun ulang FAISS index untuk vector search (rate limited: 1/menit) |
| 34 | System | `/api/delete_faiss` | POST | Menghapus semua direktori FAISS index |
| 35 | System | `/api/delete_db` | POST | Mengosongkan semua koleksi database MongoDB |

---

## Authentication & Security

### Admin Authentication
- Semua endpoint admin (kecuali `/api/health`, `/api/chat`, `/api/report_bug`) memerlukan authentication
- Login menggunakan endpoint `POST /api/admin/login` dengan password
- Session disimpan selama 2 jam (configurable)

### CSRF Protection
- Semua endpoint POST, PUT, DELETE admin memerlukan CSRF token
- CSRF token diambil dari `GET /api/csrf-token`
- Token dikirim di header: `X-CSRF-Token`

### Rate Limiting
- Login: 5 request/menit
- Chat (public & admin): 10 request/menit
- Bug Report: 3 request/menit
- Scrape/Crawl/Reindex: 1 request/menit
- General: 200 request/jam

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY` (kecuali widget-preview)

---

## Example Requests

### 1. Health Check
```bash
GET /api/health
```
**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-06-12T10:30:00.000000"
}
```

### 2. Admin Login
```bash
POST /api/admin/login
Content-Type: application/json

{
  "password": "your_admin_password"
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Login berhasil.",
  "csrf_token": "abc123..."
}
```

### 3. Get Dashboard Stats
```bash
GET /api/dashboard/stats
Cookie: session=your_session_cookie
```
**Response:**
```json
{
  "status": "success",
  "data": {
    "scraped_count": 150,
    "manual_count": 25,
    "memory_count": 50,
    "bug_count": 10,
    "bug_new": 3,
    "bug_processing": 2,
    "bug_done": 5
  }
}
```

### 4. Get All Scraped Data
```bash
GET /api/scraped-data
Cookie: session=your_session_cookie
```
**Response:**
```json
{
  "status": "success",
  "count": 150,
  "data": [
    {
      "id": "60d5ecb5f6b2a3c1d4e5f6a7",
      "url": "https://smkn2-im.sch.id/about",
      "title": "Tentang Sekolah",
      "content": "...",
      "image_url": "...",
      "scraped_at": "2026-06-12T08:00:00"
    }
  ]
}
```

### 5. Add Manual Text
```bash
POST /api/add_manual_text
Content-Type: application/json
Cookie: session=your_session_cookie
X-CSRF-Token: your_csrf_token

{
  "title": "Informasi PPDB 2026",
  "content": "Pendaftaran PPDB dibuka tanggal 1 Mei 2026..."
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Data teks manual berhasil ditambahkan."
}
```

### 6. Update Bug Status
```bash
PUT /api/bug_reports/60d5ecb5f6b2a3c1d4e5f6a7/status
Content-Type: application/json
Cookie: session=your_session_cookie
X-CSRF-Token: your_csrf_token

{
  "status": "Sedang Diproses"
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Bug report 60d5ecb5f6b2a3c1d4e5f6a7 status updated."
}
```

### 7. Public Chat
```bash
POST /api/chat
Content-Type: application/json

{
  "query": "Kapan pendaftaran PPDB dibuka?",
  "history": []
}
```
**Response:**
```json
{
  "response": "Pendaftaran PPDB SMKN 2 Indramayu dibuka pada tanggal 1 Mei 2026..."
}
```

### 8. Report Bug
```bash
POST /api/report_bug
Content-Type: multipart/form-data

description: "Fitur chat tidak berfungsi di mobile"
file: (upload screenshot/video)
```
**Response:**
```json
{
  "status": "success",
  "message": "Laporan bug berhasil dikirim."
}
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "status": "error",
  "message": "ID tidak valid."
}
```

### 401 - Unauthorized
```json
{
  "status": "error",
  "message": "Unauthorized. Please log in."
}
```

### 403 - Forbidden (CSRF Failed)
```json
{
  "status": "error",
  "message": "CSRF validation failed."
}
```

### 404 - Not Found
```json
{
  "status": "error",
  "message": "Data tidak ditemukan."
}
```

### 413 - File Too Large
```json
{
  "status": "error",
  "message": "File terlalu besar. Maksimum 16 MB."
}
```

### 429 - Rate Limited
```json
{
  "status": "error",
  "message": "Terlalu banyak permintaan. Coba lagi nanti."
}
```

### 500 - Internal Server Error
```json
{
  "status": "error",
  "message": "Terjadi kesalahan internal server."
}
```

---

## File Upload Limits

- **Max File Size**: 16 MB
- **Allowed Document Extensions**: `.txt`, `.pdf`, `.docx`, `.pptx`
- **Allowed Bug Report Extensions**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.mp4`, `.mov`, `.avi`, `.webm`

---

## Input Validation Limits

- **Max Text Content**: 100,000 characters
- **Max Query Length**: 2,000 characters
- **Max Bug Description**: 5,000 characters
- **Chat History**: Limited to last 20 messages

---

## Technology Stack

- **Backend Framework**: Flask (Python)
- **Database**: MongoDB (PyMongo)
- **Vector Search**: FAISS Index
- **AI Model**: Groq (Llama 3.1 8B Instant)
- **Libraries**:
  - `flask-limiter` - Rate limiting
  - `bleach` - HTML sanitization
  - `langchain` - Document processing
  - `beautifulsoup4` - Web scraping
  - `trafilatura` - Content extraction
  - `python-docx` - DOCX parsing
  - `PyPDF2` - PDF parsing
  - `sentence-transformers` - Embedding model

---

## Environment Variables

```env
MONGO_URI="mongodb://localhost:27017"
GROQ_API_KEY="your_groq_api_key"
ADMIN_PASSWORD_HASH="scrypt_hash_of_admin_password"
SECRET_KEY="random_secret_key_for_sessions"
```

---

## Notes

1. **Endpoint #1-7**: Public & Authentication endpoints
2. **Endpoint #8-17**: CRUD operations untuk data management (Scraped, Manual, Memory)
3. **Endpoint #18-27**: Bug reporting system dengan status tracking
4. **Endpoint #28-35**: System administration (scrape, crawl, reindex, delete)
5. Semua admin endpoint memerlukan authentication dan CSRF protection
6. Rate limiting diterapkan untuk mencegah abuse
7. Audit logging aktif untuk semua operasi admin
