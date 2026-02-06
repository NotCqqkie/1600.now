import os
import re
import urllib.parse

# Paths
ALL_QUESTIONS_PATH = r"src/data/all_questions.ts"
IMAGES_DIR = r"public/images/SAT-Style Questions"
WEB_PATH_PREFIX = "/images/SAT-Style%20Questions/"

# Get list of actual images
try:
    actual_images = os.listdir(IMAGES_DIR)
    image_list = set(actual_images)
    print(f"Indexed {len(actual_images)} images from {IMAGES_DIR}")

except FileNotFoundError:
    print(f"Error: Directory {IMAGES_DIR} not found.")
    exit(1)

# Read the TS file
with open(ALL_QUESTIONS_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# Regex to find image: "..."
def replace_image_path(match):
    original_path = match.group(1)
    
    # Check if this is a path we want to migrate
    if original_path.startswith("/images_labeled/"):
        filename = os.path.basename(original_path)
    elif original_path.startswith(WEB_PATH_PREFIX):
        # Allow re-verification/fixing of "broken" paths even if they look "correct"
        filename = original_path.replace(WEB_PATH_PREFIX, "")
        filename = urllib.parse.unquote(filename)
    else:
        return match.group(0)

    # Logic to find the correct filename in the new directory
    candidate = filename
    found = False
    
    # 1. Exact match
    if candidate in image_list:
        found = True
    
    # 2. Try removing _1 suffix (e.g. Name_1.png -> Name.png)
    if not found:
        name, ext = os.path.splitext(filename)
        if name.endswith("_1"):
            clean_name = name[:-2] + ext
            if clean_name in image_list:
                candidate = clean_name
                found = True

    # 3. Try "and_1_more" cases
    if not found:
        name, ext = os.path.splitext(filename) # Start from input filename
        # If input has _1 (e.g. Name_1.png), try Name_and_1_more.png
        if name.endswith("_1"):
            base_name = name[:-2]
            alt_name = base_name + "_and_1_more" + ext
            if alt_name in image_list:
                candidate = alt_name
                found = True
                print(f"Fixed 'and_1_more': {filename} -> {candidate}")

    final_web_path = WEB_PATH_PREFIX + candidate
    
    return f'image: "{final_web_path}"'

# Pattern: image: "..." or image: '...'
pattern = re.compile(r'image:\s*["\']([^"\']+)["\']')

new_content = pattern.sub(replace_image_path, content)

with open(ALL_QUESTIONS_PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated all_questions.ts with advanced matching")
