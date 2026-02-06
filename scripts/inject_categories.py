import json
import re
import os

# Paths (Relative to CWD or Absolute)
BASE_DIR = r"c:\Users\303da\Documents\GitHub\1600-prep-hub"
QUESTIONS_DATA_PATH = os.path.join(BASE_DIR, "src", "data", "questions_data.ts")
CATEGORY_MAP_PATH = os.path.join(BASE_DIR, "src", "data", "category_map.json")
ALL_QUESTIONS_PATH = os.path.join(BASE_DIR, "src", "data", "all_questions.ts")

def load_category_map():
    with open(CATEGORY_MAP_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def clean_text(text):
    if not text: return ""
    # Remove escaped quotes, backslashes
    text = text.replace('\\"', '"').replace("\\'", "'").replace('\\\\', '\\')
    # Lowercase + alphanumeric
    t = re.sub(r'[^a-z0-9]', '', text.lower())
    return t[:150] # 150 chars for better uniqueness

def parse_questions_data():
    print("Reading questions_data.ts...")
    with open(QUESTIONS_DATA_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    
    chunks = content.split('"question_number":')
    
    img_map = {}
    text_map = {}
    
    print(f"Parsing {len(chunks)} chunks from questions_data.ts...")
    
    for chunk in chunks[1:]:
        # ID
        m_id = re.search(r'"id":\s*"([^"]+)"', chunk)
        if not m_id: continue
        uid = m_id.group(1)
        
        # Image
        m_img = re.search(r'"src":\s*"(.*?)"', chunk)
        if m_img:
            img_path = m_img.group(1)
            img_map[img_path] = uid
            # Handle encoded spaces
            decoded = img_path.replace("%20", " ")
            if decoded != img_path:
                img_map[decoded] = uid

        # Passage
        # Robust passage extraction: look for "passage": " then content until ", "question_text"
        m_pass = re.search(r'"passage":\s*"(.*?)(?<!\\)",\s*"(?:question_text|choices)"', chunk, re.DOTALL)
        if m_pass:
            passage = m_pass.group(1)
            sig = clean_text(passage)
            if sig:
                text_map[sig] = uid
        else:
             # Fallback: just "passage": "..."
             m_pass_simple = re.search(r'"passage":\s*"(.*?)(?<!\\)"', chunk)
             if m_pass_simple:
                 sig = clean_text(m_pass_simple.group(1))
                 if sig: text_map[sig] = uid
        
        # Question Text (Fallback for non-passage questions)
        if not m_pass:
             m_qt = re.search(r'"question_text":\s*"(.*?)(?<!\\)"', chunk)
             if m_qt:
                 sig = clean_text(m_qt.group(1))
                 if sig and sig not in text_map:
                     text_map[sig] = uid

    return img_map, text_map

def process_all_questions():
    cat_map = load_category_map()
    img_lookup, text_lookup = parse_questions_data()
    
    print(f"Loaded lookups: {len(img_lookup)} images, {len(text_lookup)} text signatures")
    
    with open(ALL_QUESTIONS_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    new_lines = []
    
    # State
    current_uid = None
    interface_injected = False
    
    re_text = re.compile(r'^\s*text:\s*"(.*)",?$')
    re_img = re.compile(r'^\s*image:\s*"(.*)",?$')
    
    match_count = 0
    
    for line in lines:
        stripped = line.strip()
        
        # Inject Interface
        if "export interface Question {" in line and not interface_injected:
            category_def = """
export interface QuestionCategory {
  subject: "Math" | "English";
  domain: string;
  skill: string;
  confidence: "high" | "medium" | "low";
}

"""
            new_lines.append(category_def)
            new_lines.append(line)
            new_lines.append("  category?: QuestionCategory;\n")
            interface_injected = True
            continue
            
        # New Object Start
        if stripped == "{" or (stripped.endswith("{") and "id:" not in stripped): 
            current_uid = None
            
        # Check Image
        m_img = re_img.match(line)
        if m_img:
            img_path = m_img.group(1)
            if img_path in img_lookup:
                current_uid = img_lookup[img_path]
            elif img_path.replace(" ", "%20") in img_lookup:
                current_uid = img_lookup[img_path.replace(" ", "%20")]
        
        # Check Text (if no image match yet)
        m_text = re_text.match(line)
        if m_text and not current_uid:
            raw_text = m_text.group(1)
            # Try full
            sig = clean_text(raw_text)
            if sig in text_lookup:
                current_uid = text_lookup[sig]
            else:
                # Try splitting by delimiter for passage
                # all_questions often has "Question\\\\Passage"
                if "\\\\" in raw_text:
                    parts = raw_text.split("\\\\")
                    # Try the last part (Passage)
                    sig_pass = clean_text(parts[-1])
                    if sig_pass in text_lookup:
                        current_uid = text_lookup[sig_pass]
        
        # End Object - Inject Category
        if (stripped == "}," or stripped == "}") and current_uid:
            if current_uid in cat_map:
                cat_data = cat_map[current_uid]
                # Format as TS object
                # We can just dump JSON, but keys shouldn't be quoted strictly? TS handles JSON fine.
                json_str = json.dumps(cat_data)
                new_lines.append(f'    category: {json_str},\n')
                match_count += 1
                
        new_lines.append(line)
        
    print(f"Injected categories for {match_count} questions.")
    
    with open(ALL_QUESTIONS_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

if __name__ == "__main__":
    process_all_questions()
