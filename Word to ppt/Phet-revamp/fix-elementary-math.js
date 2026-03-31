// Fix elementary math simulations with appropriate quiz questions and real-life examples
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src/data/simulations.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Elementary Arithmetic Questions (addition, subtraction, multiplication, division)
const ARITHMETIC_QUESTIONS = [
  { q: "What is 7 + 5?", a: ["10", "11", "12", "13"], c: 2, explanation: "7 + 5 = 12" },
  { q: "What is 15 - 8?", a: ["5", "6", "7", "8"], c: 2, explanation: "15 - 8 = 7" },
  { q: "What is 6 × 4?", a: ["18", "20", "24", "28"], c: 2, explanation: "6 × 4 = 24" },
  { q: "What is 20 ÷ 5?", a: ["3", "4", "5", "6"], c: 1, explanation: "20 ÷ 5 = 4" },
  { q: "If you have 8 apples and get 3 more, how many do you have?", a: ["10", "11", "12", "5"], c: 1, explanation: "8 + 3 = 11" },
  { q: "What is 9 × 3?", a: ["21", "24", "27", "30"], c: 2, explanation: "9 × 3 = 27" },
  { q: "What is 48 ÷ 8?", a: ["4", "5", "6", "7"], c: 2, explanation: "48 ÷ 8 = 6" },
  { q: "What is 25 + 17?", a: ["32", "42", "43", "52"], c: 1, explanation: "25 + 17 = 42" },
  { q: "What is 100 - 37?", a: ["53", "63", "73", "67"], c: 1, explanation: "100 - 37 = 63" },
  { q: "If you share 24 cookies equally among 6 friends, how many does each get?", a: ["3", "4", "5", "6"], c: 1, explanation: "24 ÷ 6 = 4" }
];

// Number/Counting Questions (for number-play, make-a-ten)
const COUNTING_QUESTIONS = [
  { q: "What number comes after 9?", a: ["8", "10", "11", "0"], c: 1, explanation: "9 + 1 = 10" },
  { q: "Which is greater: 15 or 12?", a: ["15", "12", "They are equal", "Cannot tell"], c: 0, explanation: "15 is greater than 12" },
  { q: "What is 7 + 3?", a: ["9", "10", "11", "12"], c: 1, explanation: "7 + 3 = 10, we 'make a ten'!" },
  { q: "Count by 2s: 2, 4, 6, __?", a: ["7", "8", "9", "10"], c: 1, explanation: "Counting by 2s: 2, 4, 6, 8" },
  { q: "What is 10 - 4?", a: ["4", "5", "6", "7"], c: 2, explanation: "10 - 4 = 6" },
  { q: "How many tens are in 30?", a: ["2", "3", "4", "13"], c: 1, explanation: "30 = 3 tens (3 × 10)" },
  { q: "What is 5 + 5?", a: ["9", "10", "11", "15"], c: 1, explanation: "5 + 5 = 10" },
  { q: "Which number is between 7 and 9?", a: ["6", "8", "10", "5"], c: 1, explanation: "7, 8, 9 - so 8 is between them" },
  { q: "If I have 4 and add 6, how many do I have?", a: ["8", "9", "10", "11"], c: 2, explanation: "4 + 6 = 10" },
  { q: "What is double 4?", a: ["6", "8", "10", "12"], c: 1, explanation: "Double means × 2, so 4 × 2 = 8" }
];

// Fraction Questions
const FRACTION_QUESTIONS = [
  { q: "What fraction is shaded if 1 of 4 equal parts is colored?", a: ["1/2", "1/3", "1/4", "1/5"], c: 2, explanation: "1 out of 4 = 1/4" },
  { q: "Which is greater: 1/2 or 1/4?", a: ["1/2", "1/4", "Equal", "Cannot tell"], c: 0, explanation: "1/2 is half, 1/4 is a quarter. Half is more." },
  { q: "What is 1/2 + 1/2?", a: ["1", "2", "1/4", "2/4"], c: 0, explanation: "1/2 + 1/2 = 2/2 = 1 whole" },
  { q: "If you eat 2 slices of a pizza with 8 slices, what fraction did you eat?", a: ["1/4", "1/2", "2/8", "Both A and C"], c: 3, explanation: "2/8 = 1/4, so both are correct!" },
  { q: "What is an equivalent fraction to 1/2?", a: ["1/3", "2/4", "3/4", "1/4"], c: 1, explanation: "2/4 reduces to 1/2" },
  { q: "What is 3/4 - 1/4?", a: ["1/2", "2/4", "1/4", "Both A and B"], c: 3, explanation: "3/4 - 1/4 = 2/4 = 1/2" },
  { q: "A pie is cut into 6 equal slices. You take 3. What fraction do you have?", a: ["1/2", "1/3", "3/6", "Both A and C"], c: 3, explanation: "3/6 = 1/2" },
  { q: "Which is larger: 2/3 or 3/4?", a: ["2/3", "3/4", "Equal", "Cannot compare"], c: 1, explanation: "3/4 = 0.75, 2/3 ≈ 0.67. 3/4 is larger." },
  { q: "What is 1/4 of 12?", a: ["2", "3", "4", "6"], c: 1, explanation: "12 ÷ 4 = 3" },
  { q: "If you have 1/3 of a chocolate bar, how many thirds make a whole?", a: ["2", "3", "4", "1"], c: 1, explanation: "1/3 + 1/3 + 1/3 = 3/3 = 1 whole" }
];

// Real-life examples for elementary math
const ARITHMETIC_EXAMPLES = [
  {
    title: "Counting Coins",
    description: "Use addition and subtraction when counting money and making change at a store.",
    imageUrl: "/phet-revamp/assets/real-life/coins.jpg"
  },
  {
    title: "Baking Recipes",
    description: "Multiplication helps when doubling a recipe - 2 eggs become 4!",
    imageUrl: "/phet-revamp/assets/real-life/baking.jpg"
  }
];

const FRACTION_EXAMPLES = [
  {
    title: "Sharing Pizza",
    description: "When you cut a pizza into slices, you're creating fractions!",
    imageUrl: "/phet-revamp/assets/real-life/pizza.jpg"
  },
  {
    title: "Measuring Cups",
    description: "Cooking uses fractions like 1/2 cup or 1/4 teaspoon.",
    imageUrl: "/phet-revamp/assets/real-life/measuring.jpg"
  }
];

const NUMBER_EXAMPLES = [
  {
    title: "Counting Games",
    description: "Counting is everywhere - from board games to scoring points!",
    imageUrl: "/phet-revamp/assets/real-life/board-game.jpg"
  },
  {
    title: "Calendar Days",
    description: "Counting days, weeks, and months uses numbers we see every day.",
    imageUrl: "/phet-revamp/assets/real-life/calendar.jpg"
  }
];

// Apply fixes
let updated = 0;

data.simulations.forEach(sim => {
  const id = sim.id.toLowerCase();
  
  // Arithmetic
  if (id === 'arithmetic' || id.includes('multiply') || id.includes('addition')) {
    sim.gameQuestions = ARITHMETIC_QUESTIONS;
    sim.realLifeExamples = ARITHMETIC_EXAMPLES;
    updated++;
    console.log(`Fixed: ${sim.id}`);
  }
  
  // Number/Counting
  else if (id.includes('make-a-ten') || id === 'number-play' || id === 'number-compare') {
    sim.gameQuestions = COUNTING_QUESTIONS;
    sim.realLifeExamples = NUMBER_EXAMPLES;
    updated++;
    console.log(`Fixed: ${sim.id}`);
  }
  
  // Fractions
  else if (id.includes('fraction')) {
    sim.gameQuestions = FRACTION_QUESTIONS;
    sim.realLifeExamples = FRACTION_EXAMPLES;
    updated++;
    console.log(`Fixed: ${sim.id}`);
  }
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`\nTotal simulations fixed: ${updated}`);
