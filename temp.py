path_html = r'c:\Users\ACER\.gemini\antigravity\playground\glowing-hubble\index.html'
with open(path_html, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Add Version Tag next to HALLADE METHOD
old_h1 = """<span class="version-tag">HALLADE METHOD</span>"""
new_h1 = """<span class="version-tag">HALLADE METHOD</span> <span id="app-version-tag" style="font-size: 0.9rem; color: #94a3b8; font-weight: normal; margin-left: 10px;">v1.0.5</span>"""

if old_h1 in html_content:
    html_content = html_content.replace(old_h1, new_h1)

with open(path_html, 'w', encoding='utf-8') as f:
    f.write(html_content)

print("index.html version tag injected")
