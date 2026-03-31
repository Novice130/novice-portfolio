// Script to fix math simulation subjects in simulations.json
const fs = require('fs');

const filePath = 'c:/Users/Syed Amer/Documents/Phet/Word to ppt/Phet-revamp/src/data/simulations.json';

// Read the file
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Math simulation IDs that should have subject: "math"
const mathSimIds = [
  // Area simulations
  'area-builder',
  'area-model-algebra',
  'area-model-decimals',
  'area-model-introduction',
  'area-model-multiplication',
  
  // Fraction simulations
  'fraction-matcher',
  'fractions-equality',
  'fractions-intro',
  'fractions-mixed-numbers',
  
  // Number simulations
  'number-compare',
  'number-line-distance',
  'number-line-integers',
  'number-line-operations',
  'number-pairs',
  'number-play',
  
  // Graphing simulations
  'graphing-lines',
  'graphing-quadratics',
  'graphing-slope-intercept',
  
  // Equality simulations
  'equality-explorer',
  'equality-explorer-basics',
  'equality-explorer-two-variables',
  
  // Proportion simulations
  'proportion-playground',
  'ratio-and-proportion',
  
  // Other math simulations
  'make-a-ten',
  'arithmetic',
  'function-builder',
  'function-builder-basics',
  'expression-exchange',
  
  // Additional math-related simulations
  'mean-share-and-balance',
  'counting-together',
  'center-and-variability'
];

let updatedCount = 0;

// Update subjects
data.simulations.forEach(function(sim) {
  if (mathSimIds.includes(sim.id) && sim.subject !== 'math') {
    console.log('Updating ' + sim.id + ': ' + sim.subject + ' -> math');
    sim.subject = 'math';
    updatedCount++;
  }
});

console.log('\nUpdated ' + updatedCount + ' simulations to subject: math');

// Write back
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('File saved successfully!');
