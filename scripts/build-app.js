const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'www');

// Files and directories to copy to the Capacitor web directory (www)
const filesToCopy = [
  'index.html',
  'members.html',
  'photos.html',
  'events.html',
  'notarulett.html',
  'login.html',
  'register.html',
  'admin.html',
  'daloskonyv.html',
  'ck_fooldal.css',
  'api-config.js',
  'site.js',
  'notarulett.js',
  'notarulett-data.js',
  'ck_cimer_szines.png',
  'CK címer fekete-fehér.png',
  'vivatselmec.png',
  'received_1401180557458272.jpeg',
  'daloskonyv.pdf',
  'daloskonyv-data.js',
  'pdf.min.js',
  'pdf.worker.min.js',
  'CNAME'
];

const dirsToCopy = [
  'uploads',
  'admin'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Building web assets for Capacitor in www/ ...');
ensureDir(distDir);

for (const file of filesToCopy) {
  const src = path.join(rootDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`File not found, skipped: ${file}`);
  }
}

for (const dir of dirsToCopy) {
  const src = path.join(rootDir, dir);
  const dest = path.join(distDir, dir);
  if (fs.existsSync(src)) {
    copyDirRecursive(src, dest);
    console.log(`Copied directory: ${dir}`);
  }
}

console.log('Capacitor web assets prepared successfully in www/');
