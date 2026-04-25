import re
import os

file_path = r'src/data/questions_data.ts'

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Naked variables x, y, z -> $x$, $y$, $z$
# BUT only if they look like math.
# Logic: ' x ' -> ' $x$ '
# Be careful of english usage. "x-ray", "x marks the spot"? 
# In SAT context, single x,y,z usually math.
# We should probably be broader with [a-z] butblacklist common words.

# Fix 2: "f(x)" -> "$f(x)$"
# Fix 3: "y =" -> "$y=$"

# Let's start with a script that does replacement on specific patterns.

def replace_math(text):
    # Pattern: Space + variable + Space/Punctuation
    # We use a lambda to avoid replacing the spaces themselves if possible, or just build the replacement string.
    
    # Simple variables
    # Only x, y, z, k, c, n, a, b, d, t, r, p, m
    # (Leaving out 'i' (imaginary? but also 'I'), 'e' (number? but also 'a'), 'o' (no), 's' (seconds?), 'l' (length), 'w' (width), 'h' (height))
    # Let's stick to explicit math variables often seen: x, y, z, k, n, c, t
    
    # Pattern: \b(x|y|z|k|n|c|t)\b
    # But we want to avoid " a " (article)
    
    # We will use a regex that looks for specific math cues or just single letters.
    
    vars = "x|y|z|k|n|t|r|p|w|h" 
    
    # Case 1: "f(x)" or "g(x)" or "h(t)"
    text = re.sub(r'\b([fghp])\(([xytn])\)', r'$\1(\2)$', text)
    
    # Case 2: Equation-like "y = ..." or "x =" or "z >"
    # text = re.sub(r'\b([xyz])\s*([=<>])', r'$\1\2', text) # dangerous without balanced $?

    # Case 3: Naked variables
    # " of x " -> " of $x$ "
    # " and y " -> " and $y$ "
    # "is x." -> "is $x$."
    
    # We iterate to handle multiple occurrences
    
    def repl_var(m):
        prefix = m.group(1)
        var = m.group(2)
        suffix = m.group(3)
        return f"{prefix}${var}${suffix}"

    # Pattern explainer:
    # (^|[\s\(\"\'\-])  : Start of string or separator
    # (vars)            : The variable
    # ([\s\)\.,\?\-]|$): End of string or separator
    pattern = r'(^|[\s\(\"\'\-])(' + vars + r')([\s\)\.,\?\-]|$)'
    
    # Segment the text by already-existing $...$. Only edit outside.
    
    parts = re.split(r'(\$[^\$]+\$)', text)
    new_parts = []
    for i, part in enumerate(parts):
        if part.startswith('$'):
            new_parts.append(part)
        else:
            # Apply fixes to text part
            
            # Fix variables
            # We run sub multiple times to handle adjacent matches like "x y" sharing the space
            # Actually regex overlapping is tricky.
            # But plain sub with groupings usually works oal.
            
            # Fix: " x " -> "$x$"
            part = re.sub(pattern, r'\1$\2$\3', part)
            # Run again for overlaps? e.g. " x y " -> " $x$ y " -> " $x$ $y$ "
            part = re.sub(pattern, r'\1$\2$\3', part)
            
            # Fix functions f(x) not already caught
            part = re.sub(r'\b([fghp])\(([xytn])\)', r'$\1(\2)$', part)
            
            # Fix numbers next to variables? "2x" -> "$2x$"
            # Be careful of "4x4"
            
            new_parts.append(part)
            
    return "".join(new_parts)

new_content = replace_math(content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Applied math fixes to src/data/questions_data.ts")
