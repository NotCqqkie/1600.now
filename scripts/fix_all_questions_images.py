import os
import re

# Paths
ALL_QUESTIONS_PATH = r"src/data/all_questions.ts"
IMAGES_DIR = r"public/images/SAT-Style Questions"
WEB_PATH_PREFIX = "/images/SAT-Style%20Questions/"

# Get list of actual images
try:
    actual_images = os.listdir(IMAGES_DIR)
    # create a map for case insensitivity or exact match
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
    
    # Only process paths starting with /images_labeled/
    if not original_path.startswith("/images_labeled/"):
        return match.group(0) # Return unchanged

    filename = os.path.basename(original_path)
    
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
                print(f"Fixed: {filename} -> {candidate}")

    # 3. Try removing _1 (if it was before underscore? edge cases)
    
    new_path = WEB_PATH_PREFIX + candidate
    if not found:
        print(f"Warning: Image file not found for {filename} (mapped to {new_path})")
    
    return f'image: "{new_path}"'

# Pattern: image: "..." or image: '...'
# capture group 1 is the path inside quotes
pattern = re.compile(r'image:\s*["\']([^"\']+)["\']')

new_content = pattern.sub(replace_image_path, content)

with open(ALL_QUESTIONS_PATH, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated all_questions.ts")
