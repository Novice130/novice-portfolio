
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, 'src/data/simulations.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// Question Bank Generators
const TOPICS = {
  acids: {
    match: ['acid', 'base', 'ph-scale', 'molarity'],
    questions: [
      { q: "What is the pH range of an acidic solution?", a: ["0-6", "7", "8-14", "Exactly 10"], c: 0, explanation: "Acids have a pH less than 7." },
      { q: "A neutral solution has a pH of...", a: ["0", "7", "14", "10"], c: 1, explanation: "Pure water is neutral at pH 7." },
      { q: "Which ion is associated with acids?", a: ["H+ (Hydrogen)", "OH- (Hydroxide)", "Na+ (Sodium)", "Cl- (Chloride)"], c: 0, explanation: "Acids release Hydrogen ions (H+) in solution." },
      { q: "Bases turn litmus paper...", a: ["Red", "Blue", "Green", "White"], c: 1, explanation: "Bases turn red litmus paper blue." },
      { q: "What happens when you mix an acid and a base?", a: ["Explosion", "Neutralization", "Freezing", "Nothing"], c: 1, explanation: "They neutralize each other to form water and salt." },
      { q: "Which of these is a common household acid?", a: ["Vinegar", "Soap", "Bleach", "Baking Soda"], c: 0, explanation: "Vinegar contains acetic acid." },
      { q: "Which of these is a common household base?", a: ["Lemon Juice", "Soda", "Soap", "Tomato"], c: 2, explanation: "Soaps are typically basic (alkaline)." },
      { q: "Lower pH means...", a: ["Higher acidity", "Lower acidity", "Higher alkalinity", "Neutrality"], c: 0, explanation: "The lower the pH, the stronger the acid." },
      { q: "What is the pH of pure water?", a: ["0", "7", "14", "1"], c: 1, explanation: "Pure water is neutral." },
      { q: "Which scale measures acidity?", a: ["Richter Scale", "pH Scale", "Kelvin Scale", "Mohs Scale"], c: 1, explanation: "The pH scale measures how acidic or basic a substance is." }
    ]
  },
  area: {
    match: ['area', 'perimeter', 'builder'],
    questions: [
      { q: "Area is measured in...", a: ["Square units", "Linear units", "Cubic units", "Degrees"], c: 0, explanation: "Area covers a 2D surface." },
      { q: "The formula for the area of a rectangle is...", a: ["L + W", "2L + 2W", "L x W", "L / W"], c: 2, explanation: "Length times Width gives the area." },
      { q: "Perimeter is...", a: ["Space inside", "Distance around", "Volume", "Height"], c: 1, explanation: "Perimeter is the boundary length." },
      { q: "Start with a 2x3 rectangle. Double the sides. The new area is...", a: ["6", "12", "24", "48"], c: 2, explanation: "Old area 6. New is 4x6=24. Area quadruples." },
      { q: "Which shape has the largest area for a fixed perimeter?", a: ["Triangle", "Square", "Rectangle (long)", "Circle"], c: 3, explanation: "A circle maximizes area for a given perimeter." },
      { q: "A 5x5 square has an area of...", a: ["10", "20", "25", "50"], c: 2, explanation: "5 x 5 = 25." },
      { q: "If area is 20 and width is 4, length is...", a: ["4", "5", "16", "80"], c: 1, explanation: "L = Area / W = 20 / 4 = 5." },
      { q: "Creating a hole in a shape...", a: ["Increases area", "Decreases area", "Keeps area same", "Doubles area"], c: 1, explanation: "Removing material reduces the total area." },
      { q: "Can two different shapes have the same area?", a: ["Yes", "No", "Only if circles", "Impossible"], c: 0, explanation: "A 2x6 rectangle and 3x4 rectangle both have area 12." },
      { q: "Perimeter of a 3x4 rectangle is...", a: ["7", "12", "14", "24"], c: 2, explanation: "2(3) + 2(4) = 6 + 8 = 14." }
    ]
  },
  circuit: {
    match: ['circuit', 'ohm', 'resistance', 'voltage', 'battery'],
    questions: [
      { q: "Ohm's Law is...", a: ["V = IR", "F = ma", "E = mc^2", "a^2 + b^2 = c^2"], c: 0, explanation: "Voltage = Current x Resistance." },
      { q: "In a series circuit, if one bulb breaks...", a: ["Others stay on", "All go out", "Others get brighter", "Battery explodes"], c: 1, explanation: "The path is broken, so current stops." },
      { q: "In a parallel circuit, voltage is...", a: ["Same across branches", "Different in branches", "Zero", "Infinite"], c: 0, explanation: "Components in parallel share the same voltage." },
      { q: "What provides the push for electrons?", a: ["Wire", "Resistor", "Battery (Voltage)", "Switch"], c: 2, explanation: "Voltage is the electrical pressure." },
      { q: "Increasing resistance...", a: ["Increases current", "Decreases current", "No change", "Stops gravity"], c: 1, explanation: "More resistance opposes flow, reducing current." },
      { q: "Current is measured in...", a: ["Volts", "Amps", "Ohms", "Joules"], c: 1, explanation: "Amperes (Amps) measure flow." },
      { q: "Resistance is measured in...", a: ["Volts", "Amps", "Ohms", "Watts"], c: 2, explanation: "Ohms (Ω) measure resistance." },
      { q: "Electrons flow from...", a: ["Positive to Positive", "Negative to Pink", "Negative to Positive", "Up to Down"], c: 2, explanation: "Electrons are negative and seek the positive terminal." },
      { q: "A switch...", a: ["Creates energy", "Opens/Closes circuit", "Add resistance", "Colors the wire"], c: 1, explanation: "It controls the connection." },
      { q: "Short circuit means...", a: ["High resistance path", "Low resistance path", "Broken wire", "Long wire"], c: 1, explanation: "Current bypasses load via a low resistance path, dangerous." }
    ]
  },
  forces: {
    match: ['force', 'motion', 'friction', 'newton'],
    questions: [
      { q: "Newton's Second Law is...", a: ["F = ma", "E = mc^2", "v = d/t", "F = Gmm/r^2"], c: 0, explanation: "Force = Mass x Acceleration." },
      { q: "If you push harder, acceleration...", a: ["Decreases", "Increases", "Stays same", "Zero"], c: 1, explanation: "Higher force causes higher acceleration." },
      { q: "Friction acts...", a: ["With motion", "Against motion", "Perpendicular to motion", "Upwards"], c: 1, explanation: "Friction opposes the direction of sliding." },
      { q: "Inertia is related to...", a: ["Speed", "Volume", "Mass", "Color"], c: 2, explanation: "More mass means more inertia (resistance to change)." },
      { q: "Net force of zero means...", a: ["No motion", "Constant velocity", "Accelerating", "Turning"], c: 1, explanation: "Balanced forces mean no change in motion." },
      { q: "Action and Reaction forces are...", a: ["Equal and Opposite", "Different", "In same direction", "Unrelated"], c: 0, explanation: "Newton's 3rd Law." },
      { q: "Gravity pulls things...", a: ["Up", "Sideways", "Down (Center of Earth)", "North"], c: 2, explanation: "Gravity attracts towards the mass center." },
      { q: "Sliding on ice is easier because...", a: ["Low friction", "High friction", "High gravity", "Cold air"], c: 0, explanation: "Ice has a low coefficient of friction." },
      { q: "To stop a moving car, you need...", a: ["Force", "Mass", "Speed", "Gasoline"], c: 0, explanation: "A braking force is required to decelerate." },
      { q: "Weight is...", a: ["Same as mass", "Force of gravity", "Volume", "Density"], c: 1, explanation: "Weight depends on gravity (W=mg)." }
    ]
  },
    math_general: {
    match: ['arithmetic', 'number', 'calculus', 'graphing', 'function', 'fraction', 'equality', 'equation', 'expression'],
    questions: [
      { q: "In the equation y = mx + b, m represents...", a: ["Y-intercept", "Slope", "Variable", "Origin"], c: 1, explanation: "Slope is the rate of change." },
      { q: "Which is an integer?", a: ["-5", "2.5", "1/2", "pi"], c: 0, explanation: "Integers are whole numbers and their negatives." },
      { q: "To balance an equation, you must...", a: ["Add to one side", "Do same to both sides", "Erase numbers", "Guess"], c: 1, explanation: "Equality requires maintaining balance." },
      { q: "A fraction 1/2 is equal to...", a: ["0.2", "0.5", "0.25", "1.2"], c: 1, explanation: "1 divided by 2 is 0.5." },
      { q: "The absolute value |-5| is...", a: ["-5", "5", "0", "10"], c: 1, explanation: "Absolute value is distance from zero (positive)." },
      { q: "If x + 2 = 5, then x is...", a: ["2", "3", "7", "10"], c: 1, explanation: "Subtract 2 from both sides." },
      { q: "Graphing a linear equation produces a...", a: ["Circle", "Straight line", "Parabola", "Wave"], c: 1, explanation: "Linear means line." },
      { q: "Equivalent fractions...", a: ["Have same value", "Look identical", "Are always integers", "Are negative"], c: 0, explanation: "Like 1/2 and 2/4." },
      { q: "In a function y=f(x), x is the...", a: ["Output", "Input", "Constant", "Result"], c: 1, explanation: "Independent variable (Input)." },
      { q: "The sum of angles in a triangle is...", a: ["90", "180", "360", "100"], c: 1, explanation: "Euclidean geometry rule." }
    ]
  },
  waves: {
    match: ['wave', 'sound', 'light', 'interference', 'color'],
    questions: [
      { q: "Amplitude determines...", a: ["Pitch", "Loudness/Brightness", "Speed", "Frequency"], c: 1, explanation: "Higher amplitude means more energy/loudness." },
      { q: "Frequency determines...", a: ["Pitch/Color", "Loudness", "Height", "Speed"], c: 0, explanation: "Frequency sets the pitch of sound or color of light." },
      { q: "Sound needs a...", a: ["Vacuum", "Medium (Air/Water)", "Battery", "Mirror"], c: 1, explanation: "Sound is a mechanical wave." },
      { q: "Light waves are...", a: ["Longitudinal", "Transverse", "Mechanical", "Sonic"], c: 1, explanation: "Light oscillates perpendicular to motion." },
      { q: "Adding two waves together is called...", a: ["Interference", "Reflection", "Refraction", "Breaking"], c: 0, explanation: "Constructive or destructive interference." },
      { q: "Speed of light is...", a: ["Infinite", "Fastest known speed", "Slower than sound", "0"], c: 1, explanation: "c is the universal speed limit." },
      { q: "Rainbows are caused by...", a: ["Reflection", "Refraction/Dispersion", "Absorption", "Diffraction"], c: 1, explanation: "Light splitting into colors." },
      { q: "Doppler effect explains...", a: ["Echoes", "Pitch change of moving car", "Shadows", "Mirrors"], c: 1, explanation: "Frequency shift due to motion." },
      { q: "Black object...", a: ["Reflects all light", "Absorbs all heat", "Absorbs all light", "Emits light"], c: 2, explanation: "Absorbs all visible wavelengths." },
      { q: "White lighter...", a: ["Mix of all colors", "Absence of color", "Just yellow", "Laser"], c: 0, explanation: "White light contains all spectrum colors." }
    ]
  },
  chemistry_general: {
    match: ['molecule', 'atom', 'isotope', 'state', 'gas', 'liquid', 'build-a'],
    questions: [
      { q: "Protons have a charge of...", a: ["Positive", "Negative", "Neutral", "Variable"], c: 0, explanation: "+1 charge." },
      { q: "Electrons are found...", a: ["In nucleus", "Orbiting nucleus", "Inside protons", "Nowhere"], c: 1, explanation: "In shells/clouds around nucleus." },
      { q: "Isotopes have different numbers of...", a: ["Protons", "Neutrons", "Electrons", "Colors"], c: 1, explanation: "Same element, different mass." },
      { q: "Solids have...", a: ["Fixed shape", "Variable shape", "No mass", "High speed"], c: 0, explanation: "Atoms vibrate in fixed positions." },
      { q: "Heating a gas makes molecules...", a: ["Stop", "Move faster", "Shrink", "Stick"], c: 1, explanation: "Heat equals kinetic energy." },
      { q: "H2O is...", a: ["Atom", "Molecule", "Element", "Mixture"], c: 1, explanation: "Combination of Hydrogen and Oxygen atoms." },
      { q: "Density is...", a: ["Mass/Volume", "Volume/Mass", "Mass x Speed", "Weight"], c: 0, explanation: "Amount of stuff in a space." },
      { q: "Phase change from solid to liquid is...", a: ["Freezing", "Melting", "Boiling", "Sublimation"], c: 1, explanation: "Melting point." },
      { q: "In a chemical reaction, atoms are...", a: ["Destroyed", "Created", "Rearranged", "Colored"], c: 2, explanation: "Conservation of mass." },
      { q: "Periodic table organizes...", a: ["Compounds", "Elements", "Rocks", "Stars"], c: 1, explanation: "Elements by atomic number." }
    ]
  },
  energy: {
    match: ['energy', 'power', 'work', 'heat', 'thermal'],
    questions: [
      { q: "Kinetic energy is energy of...", a: ["Height", "Motion", "Springs", "Heat"], c: 1, explanation: "Moving objects have KE." },
      { q: "Potential energy is...", a: ["Stored energy", "Moving energy", "Lost energy", "Sound"], c: 0, explanation: "Stored by position or state." },
      { q: "Conservation of Energy means...", a: ["Energy is created", "Energy is destroyed", "Energy transforms, not lost", "Energy is infinite"], c: 2, explanation: "Total energy stays constant." },
      { q: "Friction turns motion into...", a: ["Potential energy", "Thermal energy (Heat)", "Light", "Gravity"], c: 1, explanation: "Rubbing hands gets warm." },
      { q: "Solar panels convert light to...", a: ["Heat", "Electricity", "Wind", "Motion"], c: 1, explanation: "Photovoltaic effect." },
      { q: "Batteries store...", a: ["Chemical energy", "Kinetic energy", "Thermal energy", "Sound"], c: 0, explanation: "Chemical reactions release electrons." },
      { q: "Unit of energy is...", a: ["Newton", "Joule", "Watt", "Volt"], c: 1, explanation: "Joules (J)." },
      { q: "Power is...", a: ["Energy x Time", "Energy / Time", "Force", "Voltage"], c: 1, explanation: "Rate of energy use (Watts)." },
      { q: "High shelf has high...", a: ["Kinetic Energy", "Gravitational Potential", "Elastic Potential", "Thermal"], c: 1, explanation: "Height gives GPE." },
      { q: "Stretched rubber band has...", a: ["Kinetic Energy", "Elastic Potential", "Gravity", "Heat"], c: 1, explanation: "Elastic potential energy." }
    ]
  }
};

const DEFAULT_QUIZ = [
  { q: "What is the main goal of this simulation?", a: ["To explore a concept", "To win a game", "To break the computer", "To sleep"], c: 0, explanation: "PhET sims are for exploration." },
  { q: "Scientists use models to...", a: ["Predict reality", "Avoid work", "Make art", "Hide truth"], c: 0, explanation: "Models simplify complex systems." },
  { q: "In science, a hypothesis is...", a: ["A guess", "A testable prediction", "A fact", "A law"], c: 1, explanation: "Must be testable." },
  { q: "Data is...", a: ["Opinions", "Collected information", "random numbers", "Code"], c: 1, explanation: "Evidence from experiments." },
  { q: "Which step comes first?", a: ["Conclusion", "Experiment", "Observation", "Theory"], c: 2, explanation: "Science starts with observing." }
];

console.log('Generating quiz content...');

let updatedCount = 0;

data.simulations.forEach(sim => {
  const sid = sim.id.toLowerCase();
  
  // Find best matching topic
  let bestMatch = null;
  
  // Check specific overrides first (if valid)
  // ... skip specific for now, use category matching
  
  // Category match
  for (const [key, category] of Object.entries(TOPICS)) {
    if (category.match.some(m => sid.includes(m))) {
      bestMatch = category.questions;
      break;
    }
  }

  // Fallback to subjects?
  if (!bestMatch && sim.subject === 'math') bestMatch = TOPICS.math_general.questions;
  if (!bestMatch && sim.subject === 'chemistry') bestMatch = TOPICS.chemistry_general.questions;
  if (!bestMatch && sim.subject === 'physics') bestMatch = TOPICS.forces.questions; // Default physics to forces? or use DEFAULT
  
  // Use match or default
  const questions = bestMatch || DEFAULT_QUIZ;
  
  // Always set at least 10 questions (duplicate if needed for now, but ideal is unique)
  // Since my banks are exactly 10, it fits.
  
  sim.gameQuestions = questions;
  updatedCount++;
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log(`Updated quizzes for ${updatedCount} simulations.`);
