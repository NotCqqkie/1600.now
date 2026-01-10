import os
from pathlib import Path
from pypdf import PdfReader

file_path = r"c:\Users\303da\Downloads\Math\Advanced Math\Equivalent Expressions\Equivalent Expressions 1.pdf"

if os.path.exists(file_path):
    reader = PdfReader(file_path)
    print(f"Total Pages: {len(reader.pages)}")
    text = ""
    # Check first 2 and last 2 pages
    for i in range(min(2, len(reader.pages))):
        text += f"==== PAGE {i} ====\n" + reader.pages[i].extract_text() + "\n"
    
    for i in range(max(2, len(reader.pages)-2), len(reader.pages)):
        text += f"==== PAGE {i} ====\n" + reader.pages[i].extract_text() + "\n"
        
    print(text.encode('utf-8'))
else:
    print("File not found")
