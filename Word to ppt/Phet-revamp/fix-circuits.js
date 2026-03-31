// Fix remaining external URLs
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src/data/simulations.json');
const assetsDir = path.join(__dirname, 'public/assets/real-life');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Circuit images to download
const CIRCUIT_IMAGES = {
  'circuit-ac.jpg': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&fit=crop',
  'circuit-dc.jpg': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&fit=crop'
};

async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(assetsDir, filename);
    if (fs.existsSync(filepath)) {
      console.log(`Exists: ${filename}`);
      return resolve();
    }
    
    const file = fs.createWriteStream(filepath);
    https.get(url, response => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return https.get(response.headers.location, res => {
          res.pipe(file);
          file.on('finish', () => { file.close(); console.log(`Downloaded: ${filename}`); resolve(); });
        });
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); console.log(`Downloaded: ${filename}`); resolve(); });
    }).on('error', e => reject(e));
  });
}

async function main() {
  // Download images
  for (const [filename, url] of Object.entries(CIRCUIT_IMAGES)) {
    await downloadImage(url, filename);
  }
  
  // Update simulations
  data.simulations.forEach(sim => {
    if (sim.id === 'circuit-construction-kit-ac') {
      sim.realLifeExamples = [
        { title: "Power Grid", description: "AC electricity powers our homes through the electrical grid.", imageUrl: "/phet-revamp/assets/real-life/circuit-ac.jpg" },
        { title: "Transformers", description: "AC can be easily transformed to different voltages for transmission.", imageUrl: "/phet-revamp/assets/real-life/power-transformer.jpg" }
      ];
    }
    if (sim.id === 'circuit-construction-kit-dc') {
      sim.realLifeExamples = [
        { title: "Batteries & Devices", description: "DC powers portable electronics like phones and flashlights.", imageUrl: "/phet-revamp/assets/real-life/circuit-dc.jpg" },
        { title: "Electric Cars", description: "Electric vehicles run on DC power from large battery packs.", imageUrl: "/phet-revamp/assets/real-life/electric-car.jpg" }
      ];
    }
  });
  
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log('Fixed circuit simulations!');
}

main();
