path_html = r'c:\Users\ACER\.gemini\antigravity\playground\glowing-hubble\index.html'
with open(path_html, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Remove <script src="script.js"></script> from wherever it is
html_content = html_content.replace('<script src="script.js"></script>', '')

# Add it back right before </body>
html_content = html_content.replace('</body>', '    <script src="script.js"></script>\n</body>')

with open(path_html, 'w', encoding='utf-8') as f:
    f.write(html_content)

print("index.html fixed.")
