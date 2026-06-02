path_html = r'c:\Users\ACER\.gemini\antigravity\playground\glowing-hubble\index.html'
with open(path_html, 'r', encoding='utf-8') as f:
    html_content = f.read()

html_content = html_content.replace('<span id="credits-version">1.0.4</span>', '<span id="credits-version">1.0.5</span>')
html_content = html_content.replace('id="app-version-tag" style="font-size: 0.9rem; color: #94a3b8; font-weight: normal; margin-left: 10px;">v1.0.4</span>', 'id="app-version-tag" style="font-size: 0.9rem; color: #94a3b8; font-weight: normal; margin-left: 10px;">v1.0.5</span>')

# Add 1.0.5 to changelog
changelog_old = """<div id="changelog-list" class="changelog-item" style="max-height: 400px; overflow-y: auto; text-align: left; margin-top: 20px; line-height: 1.6;">
                <p><strong>v1.0.4</strong>"""
changelog_new = """<div id="changelog-list" class="changelog-item" style="max-height: 400px; overflow-y: auto; text-align: left; margin-top: 20px; line-height: 1.6;">
                <p><strong>v1.0.5</strong> - UI Refinements, Earthwork UI Matching, Progress bars, and new 3D Icon.</p>
                <p><strong>v1.0.4</strong>"""

html_content = html_content.replace(changelog_old, changelog_new)

with open(path_html, 'w', encoding='utf-8') as f:
    f.write(html_content)

print("index.html static tags updated")
