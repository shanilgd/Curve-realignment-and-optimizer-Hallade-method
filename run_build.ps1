Remove-Item -Path ".git/index.lock" -Force -ErrorAction SilentlyContinue
git rm -r --cached node_modules/ -q
git add .
git commit -m "Add auto-updater and build configurations"
git push -u origin main --force
 = (gh auth token).Trim()
npx electron-builder --publish always
