import os
import hashlib
import requests
import re
from pathlib import Path

# Configuration
IMAGE_OUTPUT_DIR = Path("sat_data/images")

def sanitize_filename(name):
    """Sanitizes a string to be safe for filenames."""
    return re.sub(r'[<>:"/\\|?*]', '_', name)

def get_image_hash(url):
    """Generates MD5 hash of the image URL."""
    return hashlib.md5(url.encode('utf-8')).hexdigest()

def download_image(url, test_name, question_num, img_index, cookies=None):
    """
    Downloads an image, saves it with a hashed filename, and returns the local path.
    
    Args:
        url (str): The source URL of the image.
        test_name (str): The name of the test (used for folder structure).
        question_num (str/int): Question number.
        img_index (int): Index of the image in the question.
        cookies (dict): Cookies to use for the request (to bypass protections).
        
    Returns:
        str: The local path to the saved image, or None if failed.
    """
    try:
        # Create directory
        sanitized_test_name = sanitize_filename(test_name)
        save_dir = IMAGE_OUTPUT_DIR / sanitized_test_name
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate filename
        url_hash = get_image_hash(url)
        # simplistic extension detection
        ext = "png"
        if "." in url.split("/")[-1]:
            possible_ext = url.split("/")[-1].split(".")[-1].split("?")[0]
            if possible_ext.lower() in ['png', 'jpg', 'jpeg', 'svg', 'gif']:
                ext = possible_ext
        
        filename = f"q{question_num}_{img_index}_{url_hash}.{ext}"
        local_path = save_dir / filename
        
        # Check if already exists (deduplication by filename structure, though hash check is better)
        if local_path.exists():
            print(f"Image already exists: {local_path}")
            return str(local_path).replace("\\", "/")

        # Download
        print(f"Downloading {url}...")
        response = requests.get(url, cookies=cookies, timeout=10)
        response.raise_for_status()
        
        with open(local_path, "wb") as f:
            f.write(response.content)
            
        return str(local_path).replace("\\", "/")
        
    except Exception as e:
        print(f"Failed to download image {url}: {e}")
        return None

def process_html_content(html_content, test_name, question_num):
    """
    Parses HTML content, finds <img> tags, downloads them, and updates the src.
    This is a simplified example of the scraping logic.
    """
    # This regex is a simple placeholder. A proper HTML parser (BeautifulSoup) is recommended.
    img_matches = re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', html_content)
    
    processed_images = []
    
    for i, match in enumerate(img_matches):
        src_url = match.group(1)
        
        # Logic to download
        local_path = download_image(src_url, test_name, question_num, i)
        
        if local_path:
            processed_images.append({
                "original_src": src_url,
                "local_src": local_path
            })
            
    return processed_images

if __name__ == "__main__":
    # Example usage
    test_url = "https://example.com/image.png"
    # Create the directory if it doesn't exist for the test
    print("Testing sat_scraper logic...")
    # download_image(test_url, "Practice Test 1", 1, 0)
