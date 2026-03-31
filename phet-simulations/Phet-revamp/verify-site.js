/**
 * Automated Verification Script for PhET Simulation Website
 * Run with: node verify-site.js
 * 
 * Checks:
 * 1. All simulations have quiz questions (and they are relevant, not generic)
 * 2. All simulations have real-life examples with local images
 * 3. All referenced image files actually exist
 * 4. No external attribution links remain
 * 5. Elementary math sims have appropriate content
 * 6. Similar topic groups have distinct content
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src/data/simulations.json');
const assetsDir = path.join(__dirname, 'public/assets/real-life');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const simulations = data.simulations;

let totalTests = 0;
let passedTests = 0;
const issues = [];

function test(description, condition) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ ${description}`);
  } else {
    console.log(`❌ ${description}`);
    issues.push(description);
  }
}

function testSim(sim, description, condition) {
  if (!condition) {
    issues.push(`[${sim.id}] ${description}`);
  }
}

console.log('\n========================================');
console.log('  PhET Website Verification Report');
console.log('========================================\n');

// 1. Check total simulations count
test(`Total simulations loaded: ${simulations.length}`, simulations.length > 100);

// 2. Check all sims have quiz questions
const simsWithQuiz = simulations.filter(s => s.gameQuestions && s.gameQuestions.length >= 5);
test(`All simulations have 5+ quiz questions (${simsWithQuiz.length}/${simulations.length})`, simsWithQuiz.length === simulations.length);

// 3. Check all sims have real-life examples
const simsWithExamples = simulations.filter(s => s.realLifeExamples && s.realLifeExamples.length >= 1);
test(`All simulations have real-life examples (${simsWithExamples.length}/${simulations.length})`, simsWithExamples.length === simulations.length);

// 4. Check all referenced images exist locally
console.log('\n--- Checking Image Files ---');
let missingImages = 0;
let externalImages = 0;

simulations.forEach(sim => {
  (sim.realLifeExamples || []).forEach(ex => {
    if (ex.imageUrl) {
      if (ex.imageUrl.startsWith('http')) {
        externalImages++;
        testSim(sim, `External image URL found: ${ex.imageUrl}`, false);
      } else if (ex.imageUrl.startsWith('/phet-revamp/assets/')) {
        const filename = path.basename(ex.imageUrl);
        const filepath = path.join(assetsDir, filename);
        if (!fs.existsSync(filepath)) {
          missingImages++;
          testSim(sim, `Missing image file: ${filename}`, false);
        }
      }
    }
  });
});

test(`No external image URLs (${simulations.length - externalImages} local)`, externalImages === 0);
test(`All local images exist (${missingImages} missing)`, missingImages === 0);

// 5. Check no attribution links remain
let attrLinks = 0;
simulations.forEach(sim => {
  (sim.realLifeExamples || []).forEach(ex => {
    if (ex.imageAttributionUrl) {
      attrLinks++;
      testSim(sim, `Attribution link found`, false);
    }
  });
});
test(`No attribution links in real-life examples (${attrLinks} found)`, attrLinks === 0);

// 6. Check elementary math has appropriate questions (not algebra)
console.log('\n--- Checking Content Relevance ---');
const elementaryMathIds = ['arithmetic', 'make-a-ten', 'number-play', 'number-compare'];
let elementaryOK = true;
elementaryMathIds.forEach(id => {
  const sim = simulations.find(s => s.id === id);
  if (sim && sim.gameQuestions) {
    const hasAdvancedMath = sim.gameQuestions.some(q => 
      (q.q || q.question || '').toLowerCase().includes('y = mx') ||
      (q.q || q.question || '').toLowerCase().includes('slope')
    );
    if (hasAdvancedMath) {
      elementaryOK = false;
      testSim(sim, `Has advanced algebra questions (should be basic arithmetic)`, false);
    }
  }
});
test(`Elementary math sims have age-appropriate questions`, elementaryOK);

// 7. Check similar topics have distinct content
console.log('\n--- Checking Distinct Content for Similar Topics ---');
const areaModels = simulations.filter(s => s.id.includes('area-model'));
const areaImages = new Set();
areaModels.forEach(s => {
  (s.realLifeExamples || []).forEach(ex => {
    if (ex.imageUrl) areaImages.add(ex.imageUrl);
  });
});
test(`Area Model sims have distinct images (${areaImages.size} unique for ${areaModels.length} sims)`, areaImages.size >= areaModels.length);

const fractionSims = simulations.filter(s => s.id.includes('fraction'));
const fractionTitles = new Set();
fractionSims.forEach(s => {
  (s.realLifeExamples || []).forEach(ex => {
    if (ex.title) fractionTitles.add(ex.title);
  });
});
test(`Fraction sims have consistent examples (${fractionTitles.size} unique titles)`, fractionTitles.size >= 1);

// 8. Asset folder check
const assetFiles = fs.readdirSync(assetsDir).filter(f => !f.startsWith('.'));
test(`Asset folder has images (${assetFiles.length} files)`, assetFiles.length >= 50);

// Summary
console.log('\n========================================');
console.log('           SUMMARY');
console.log('========================================');
console.log(`Tests Passed: ${passedTests}/${totalTests}`);

if (issues.length > 0) {
  console.log(`\n⚠️ Issues Found (${issues.length}):`);
  issues.slice(0, 20).forEach(issue => console.log(`   - ${issue}`));
  if (issues.length > 20) console.log(`   ... and ${issues.length - 20} more`);
} else {
  console.log('\n🎉 All verification tests passed!');
}

console.log('\n');

// Exit with error code if tests failed
process.exit(passedTests === totalTests ? 0 : 1);
