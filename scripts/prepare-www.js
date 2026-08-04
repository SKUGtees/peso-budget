// Copies the PWA's web assets (served from repo root via GitHub Pages)
// into www/, which is the source Capacitor packages into the native app.
// Root files stay the single source of truth; www/ is a disposable build artifact.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const wwwDir = path.join(root, 'www');
const files = ['index.html', 'manifest.json', 'sw.js', 'sortable.min.js', 'icon.png'];

fs.mkdirSync(wwwDir, { recursive: true });
for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(wwwDir, file));
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyDirRecursive(path.join(root, 'assets'), path.join(wwwDir, 'assets'));

console.log('Copied', files.length, 'files and assets/ into www/');
