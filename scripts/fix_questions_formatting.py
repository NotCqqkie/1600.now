import re

def fix_formatting_oddities(file_path):
    print(f"Processing {file_path}...")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Count occurrences before
    count_8_backslashes = content.count('\\\\\\\\')
    print(f"Found {count_8_backslashes} occurrences of 8-backslashes ('\\\\\\\\').")

    if count_8_backslashes == 0:
        print("No issues found to fix.")
        return

    # Fix: Replace 8 backslashes with 4 backslashes
    # In the JS string, 8 backslashes represents 4 literal backslashes in memory (\\\\)
    # 4 backslashes represents 2 literal backslashes in memory (\\)
    # Both are rendered as <br /><br /> by renderMixedContent().
    # We standardize to the shorter 4-backslash version.
    
    new_content = content.replace('\\\\\\\\', '\\\\\\\\') # Wait, python string escaping!
    
    # In Python string literal:
    # '\\' is ONE backslash.
    # '\\\\' is TWO backslashes.
    # '\\\\\\\\' is FOUR backslashes.
    
    # The file content has literal characters.
    # If the file has 8 backslashes: \ \ \ \ \ \ \ \
    # We want to replace it with 4 backslashes: \ \ \ \
    
    # In Python 'content' string, these are just characters.
    # So replace string "\\\\\\\\" with "\\\\"
    
    fixed_content = content.replace('\\\\\\\\', '\\\\\\\\')
    # Wait. If I write replace('\\\\\\\\', ...) in python source:
    # '\\\\\\\\' -> 4 backslashes? No.
    # In Python '' string: \\ -> \.
    # So to get 8 literal backslashes, I need 16 backslashes in the python literal?
    # No, let's use raw strings r''
    
    # r'\\' -> matches 2 backslashes.
    # We want to match 8 characters of '\'.
    # r'\\\\\\\\\\\\\\\\' ?
    
    # Let's test this logic.
    # file content: "A \\ B" (contains space, backslash, space)
    # python string: 'A \\ B' (len 4: A, space, \, space) ?? No.
    # If I read file, and file has byte 0x5C (\), python string has 0x5C.
    
    # So if file has 8 consecutive 0x5C bytes:
    # content has 8 backslashes.
    
    # replace target: 8 backslashes.
    # replacement: 4 backslashes.
    
    fixed_content = content.replace('\\' * 8, '\\' * 4)
    
    # Verify exact same issues (the user said "fix all exact same issues")
    
    if fixed_content == content:
        print("No changes made (replace failed?).")
        return

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"Successfully fixed {count_8_backslashes} occurrences.")
    except Exception as e:
        print(f"Error writing file: {e}")

if __name__ == "__main__":
    fix_formatting_oddities(r'src/data/questions.ts')
