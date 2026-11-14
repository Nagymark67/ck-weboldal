const fs = require('fs');
const path = require('path');
const https = require('https');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error('Failed to download: ' + response.statusCode));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const root = path.resolve(__dirname, '..');
  console.log('Downloading PDF.js...');
  await download('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', path.join(root, 'pdf.min.js'));
  console.log('Downloaded pdf.min.js');
  await download('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js', path.join(root, 'pdf.worker.min.js'));
  console.log('Downloaded pdf.worker.min.js');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
