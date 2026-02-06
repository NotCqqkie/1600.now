import json
import re

def fix_intro_text_formatting(file_path):
    print(f"Processing {file_path}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    modified_count = 0
    
    # Pattern for Research Notes
    # "While researching a topic, a student has taken the following notes: "
    # We want to ensure a newline follows the colon.
    notes_pattern = re.compile(r'(While researching a topic, a student has taken the following notes:)\s+(?=\S)')
    
    # Pattern for Text/Poetry Intro
    intro_start_str = "The following text is from "
    
    # Common abbreviations to avoid splitting on
    # Add single uppercase letters to avoid splitting "E. Pauline"
    abbrevs = {"Mrs", "Mr", "Dr", "St", "Ms", "Prof", "Capt", "Gen", "Sen", "Rep", "Gov"}

    for item in data:
        if 'passage' in item and item['passage']:
            original_passage = item['passage']
            new_passage = original_passage
            
            # --- Fix Bad Splits (Revert single letter splits) ---
            # Look for "X.\nY" where X is single letter.
            # This fixes the previous run's error.
            # Regex: Word boundary, Single Cap, Dot, Newline, Cap
            bad_split_pattern = r'\b([A-Z])\.\n(?=[A-Z])'
            # Check if likely a bad split. 
            if re.search(bad_split_pattern, new_passage):
                 new_passage = re.sub(bad_split_pattern, r'\1. ', new_passage)

            # --- Fix Research Notes ---
            if "While researching a topic, a student has taken the following notes:" in new_passage:
                new_passage = notes_pattern.sub(r'\1\n', new_passage)
            
            # --- Fix Text Intro ---
            cursor = 0
            while True:
                start_idx = new_passage.find(intro_start_str, cursor)
                if start_idx == -1:
                    break
                
                # Limit search region
                search_region_end = min(len(new_passage), start_idx + 400)
                search_region = new_passage[start_idx:search_region_end]
                
                # Regex to find potential sentence endings
                pot_endings = list(re.finditer(r'([.?!]["”]?)\s+(?=[A-Z"“])', search_region))
                
                split_point = -1
                
                for match in pot_endings:
                    # Check predecessor
                    punc_pos = match.start()
                    pre_text = search_region[max(0, punc_pos-10):punc_pos]
                    
                    tokens = pre_text.split()
                    if tokens:
                        last_word = tokens[-1]
                        # Check if it is a known abbreviation OR a single letter (Initial)
                        if last_word in abbrevs or (len(last_word) == 1 and last_word.isupper()):
                            continue # Skip this abbreviation
                    
                    # Valid split point
                    m_start = start_idx + match.start()
                    m_end = start_idx + match.end()
                    
                    punctuation = match.group(1)
                    
                    # Check if already formatted
                    existing_text = new_passage[m_start:m_end]
                    # If it contains newline exactly as we want "\n", mark done.
                    if existing_text == punctuation + "\n":
                        split_point = -2 
                        break 
                    
                    split_point = (m_start, m_end, punctuation)
                    break
                
                if split_point == -1:
                    cursor = start_idx + len(intro_start_str)
                    continue
                elif split_point == -2:
                     # Already correctly formatted, advance loop
                     # Need to ensure we don't get stuck on the same intro match
                     cursor = start_idx + len(intro_start_str)
                     continue
                
                # Apply split
                sp_start, sp_end, punctuation = split_point
                new_passage = new_passage[:sp_start] + punctuation + "\n" + new_passage[sp_end:]
                
                # Update cursor
                cursor = sp_start + len(punctuation) + 1

            if new_passage != original_passage:
                item['passage'] = new_passage
                modified_count += 1

    print(f"Modified {modified_count} questions.")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    fix_intro_text_formatting(r"c:\Users\303da\Documents\GitHub\1600-prep-hub\src\data\questions.json")
