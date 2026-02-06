import json
import os

def escape_for_typescript(text):
    """
    Escapes text for a TypeScript string literal.
    Crucially, converts newlines '\n' to double-escaped backslashes '\\\\' 
    so they render as literal line breaks in the JS string.
    """
    if not text:
        return ""
    
    # 1. Basic escape for backslashes first to avoid double-escaping later
    # If the text has a literal backslash (like \pi), we want it to be \\pi in the file
    # text = text.replace('\\', '\\\\') 
    
    # 2. Handle Quotes
    text = text.replace('"', '\\"')
    
    # 3. The Critical Step: Newline conversion
    # We want '\n' (actual newline) to become '\\\\' (literal double backslash string)
    # logic: text.replace('\n', '\\\\')
    # Note: If the text is "Line 1\nLine 2", this produces "Line 1\\\\Line 2"
    text = text.replace('\n', '\\\\')
    
    return text

def convert_to_typescript(json_path, output_path):
    print(f"Reading {json_path}...")
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Input file not found.")
        return

    print(f"Converting {len(data)} items to TypeScript...")
    
    ts_lines = ["export const allQuestions = ["]
    
    for item in data:
        ts_lines.append("  {")
        
        # Process fields
        for key, value in item.items():
            if key == "choices":
                ts_lines.append(f'    "{key}": [')
                for choice in value:
                    ts_lines.append("      {")
                    for c_key, c_val in choice.items():
                        if c_key == "text" and isinstance(c_val, str):
                            escaped_text = escape_for_typescript(c_val)
                            ts_lines.append(f'        "{c_key}": "{escaped_text}",')
                        elif c_key == "images" or c_key == "image":
                             # Image Logic: verify which path to use
                             # User Note: "Currently, the TS converter is using the original remote source ('src') URL"
                             # If we wanted local, we would check for a 'local_src' field here.
                             ts_lines.append(f'        "{c_key}": {json.dumps(c_val)},')
                        else:
                            ts_lines.append(f'        "{c_key}": {json.dumps(c_val)},')
                    ts_lines.append("      },")
                ts_lines.append("    ],")
            
            elif isinstance(value, str):
                # Apply the line break logic to string fields like passage/text
                escaped_val = escape_for_typescript(value)
                ts_lines.append(f'    "{key}": "{escaped_val}",')
            else:
                ts_lines.append(f'    "{key}": {json.dumps(value)},')
                
        ts_lines.append("  },")
        
    ts_lines.append("];")
    ts_lines.append("export default allQuestions;")

    print(f"Writing to {output_path}...")
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(ts_lines))
        
    print("Done.")

if __name__ == "__main__":
    # Example usage:
    # convert_to_typescript("src/data/questions.json", "src/data/questions_data_new.ts")
    pass
