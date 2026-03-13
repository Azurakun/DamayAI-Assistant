import requests
import trafilatura
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import docx
import PyPDF2
from pptx import Presentation

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def extract_text_from_pdf(file_stream):
    """Mengekstrak teks dari file PDF."""
    try:
        reader = PyPDF2.PdfReader(file_stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None

def extract_text_from_docx(file_stream):
    """Mengekstrak teks dari file DOCX."""
    try:
        doc = docx.Document(file_stream)
        return "\n".join([para.text for para in doc.paragraphs])
    except Exception as e:
        print(f"Error reading DOCX: {e}")
        return None

def extract_text_from_pptx(file_stream):
    """Mengekstrak teks dari file PPTX."""
    try:
        prs = Presentation(file_stream)
        text = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text.append(shape.text)
        return "\n".join(text)
    except Exception as e:
        print(f"Error reading PPTX: {e}")
        return None


def extract_single_page(url):
    """
    Extracts content and the single best thumbnail image URL from a page.
    FIX #5: Stores only ONE image_url (og:image preferred, else first in-content image).
    This prevents comma-joined multi-URL strings from breaking img src attributes.
    """
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        response.encoding = response.apparent_encoding
        
        html_content = response.text
        content = trafilatura.extract(html_content, include_comments=False, include_tables=True)
        title = trafilatura.extract_metadata(html_content).title
        
        soup = BeautifulSoup(html_content, 'html.parser')
        primary_image_url = None

        # Priority 1: og:image — best thumbnail/representative image
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            primary_image_url = urljoin(url, og_image['content'])

        # Priority 2: First <img> inside the extracted content body
        if not primary_image_url and content:
            content_soup = BeautifulSoup(content, 'html.parser')
            first_img = content_soup.find('img')
            if first_img and first_img.get('src'):
                primary_image_url = urljoin(url, first_img['src'])

        if content:
            return {"status": "success", "url": url, "title": title, "content": content, "image_url": primary_image_url}
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