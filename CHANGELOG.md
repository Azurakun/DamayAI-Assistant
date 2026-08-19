# Changelog DamayAI-Assistant

Catatan riwayat perubahan (log) dari seluruh modifikasi yang telah dilakukan pada proyek ini.

## Peningkatan Infrastruktur & Keamanan
- **Perbaikan Konfigurasi API Key**: Memperbaiki sintaks *hardcoded* API Key yang sebelumnya menyebabkan *Syntax Error* karena kurangnya tanda kutip di `backend/app.py`.
- **Implementasi .env**: Mengamankan `GEMINI_API_KEY`, `SECRET_KEY`, dan `ADMIN_PASSWORD` ke dalam file `backend/.env` agar tidak bocor dan mematuhi standar keamanan (Best Practice).
- **Update Versi Model AI**: Mengganti model `gemini-1.5-flash` yang sudah *deprecated* (kadaluarsa) dan menyebabkan error 404, menjadi model `gemini-2.5-flash` yang jauh lebih baru, cepat, dan didukung oleh *API Key* pengguna.
- **Konfigurasi Password Admin**: Menambahkan `ADMIN_PASSWORD` (default: `admin123`) di `.env` agar pengguna dapat masuk ke panel administrasi.

## Perubahan Arsitektur RAG (Retrieval-Augmented Generation)
- **Pemisahan Sumber Data**: Mengubah struktur *database* (`backend/database.py`) untuk memisahkan data input manual menjadi dua wadah terpisah: **Data Teks Manual** dan **Data Dokumen (File)** berdasarkan ada tidaknya `file_path`.
- **Ekspansi FAISS Index**: Memperbarui `backend/vector_store.py` untuk mengolah dan menghasilkan 4 indeks FAISS terpisah (sebelumnya 3) untuk pencarian vektor yang lebih spesifik.
- **Implementasi Hierarki Prioritas 4 Tahap**: Memodifikasi fungsi `generate_response` di `backend/app.py` agar AI mengambil referensi dengan urutan prioritas ketat:
  1. Memory Bank (Prioritas  tertinggi, diisi secara manual)
  2. Data Teks Manual
  3. Data Dokumen (File Upload seperti PDF/ Word)
  4. Website Scraping (Prioritas terendah)

## Peningkatan Kualitas AI (Anti-Halusinasi)
- **Pembaruan System Prompt**: Memodifikasi *system prompt* di `backend/app.py` untuk mewajibkan AI mengikuti hierarki prioritas data yang baru.
- **Pencegahan Halusinasi**: AI kini diberikan perintah ketat untuk **dilarang mengarang jawaban** apabila informasi tidak tersedia di keempat sumber RAG.

## Pembaruan Antarmuka (UI/UX)
- **Pemisahan Tab Filter**: Memperbarui tampilan menu *Data Bank* di `frontend/admin-data-bank.html` dan logika aplikasinya di `frontend/admin.js` agar memiliki dua tombol filter terpisah untuk **Teks Manual** dan **Upload Dokumen** (menggantikan tombol "Manual Upload" sebelumnya).
- Mengubah *mapping* `typeClasses` di JavaScript untuk menyelaraskan status tampilan sesuai format data yang baru.
