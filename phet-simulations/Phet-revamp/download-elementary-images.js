// Download images for elementary math simulations
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, 'public/assets/real-life');

const IMAGES = {
  'coins.jpg': 'https://images.unsplash.com/photo-1611323593169-e27f72c6693b?w=800&fit=crop',
  'baking.jpg': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&fit=crop',
  'pizza.jpg': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&fit=crop',
  'measuring.jpg': 'https://images.unsplash.com/photo-1595908129746-57ca1a63dd4d?w=800&fit=crop',
  'board-game.jpg': 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=800&fit=crop',
  'calendar.jpg': 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&fit=crop'
};

function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(assetsDir, filename);
    
    // Skip if already exists
    if (fs.existsSync(filepath)) {
      console.log(`Skipped (exists): ${filename}`);
      return resolve();
    }
    
    const file = fs.createWriteStream(filepath);
    https.get(url, response => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return https.get(response.headers.location, res => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Downloaded: ${filename}`);
            resolve();
          });
        });
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${filename}`);
        resolve();
      });
    }).on('error', err => {
      fs.unlink(filepath, () => {});
      console.error(`Failed: ${filename}`, err.message);
      reject(err);
    });
  });
}

async function main() {
  console.log('Downloading elementary math images...\n');
  
  for (const [filename, url] of Object.entries(IMAGES)) {
    try {
      await downloadImage(url, filename);
    } catch (e) {
      console.error(`Error downloading ${filename}`);
    }
  }
  
  console.log('\nDone!');
}

main();
