import json

path = r'c:\Users\ACER\.gemini\antigravity\playground\glowing-hubble\package.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

data['version'] = '1.0.4'

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Version bumped to 1.0.4")
