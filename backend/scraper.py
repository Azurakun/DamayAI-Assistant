import requests
import trafilatura
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def extract_single_page(url):
    """
    Extracts content and ALL relevant image URLs from a single page.
    """
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        
        html_content = response.text
        content = trafilatura.extract(html_content, include_comments=False, include_tables=True)
        title = trafilatura.extract_metadata(html_content).title
        
        # Logika baru untuk mengambil BANYAK gambar
        image_urls = set() # Menggunakan set untuk menghindari duplikat
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Prioritas 1: Ambil og:image sebagai gambar utama/thumbnail
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            # Pastikan URL absolut
            image_urls.add(urljoin(url, og_image['content']))

        # Prioritas 2: Cari semua gambar di dalam konten utama yang diekstrak trafilatura
        if content:
            content_soup = BeautifulSoup(content, 'html.parser')
            for img_tag in content_soup.find_all('img'):
                if img_tag.get('src'):
                    # Pastikan URL absolut
                    image_urls.add(urljoin(url, img_tag['src']))
        
        # Gabungkan semua URL gambar menjadi satu string, dipisahkan koma
        all_images_str = ",".join(list(image_urls))

        if content:
            return {"status": "success", "url": url, "title": title, "content": content, "image_url": all_images_str}
        else:
            return {"status": "skipped", "url": url, "reason": "No main content found", "image_url": None}

    except requests.exceptions.RequestException as e:
        return {"status": "error", "url": url, "reason": str(e), "image_url": None}

def scrape_from_file(file_path):
    """
    Reads a file of URLs and yields the extraction result for each URL.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            urls = [line.strip() for line in f if line.strip() and not line.startswith('#')]
    except FileNotFoundError:
        yield {"status": "error", "url": file_path, "reason": "File not found"}
        return
        
    yield {"status": "info", "message": f"Ditemukan {len(urls)} URL untuk di-scrape."}

    for url in urls:
        yield extract_single_page(url)