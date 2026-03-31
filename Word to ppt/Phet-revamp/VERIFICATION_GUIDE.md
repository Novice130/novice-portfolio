# PhET Simulation Website - Complete Verification Guide

## Quick Start
```bash
# Run automated tests
node verify-site.js

# Start dev server
npm run dev

# View site
http://localhost:3000/phet-revamp/
```

---

## 1. AUTOMATED TESTING (Unit/Integration)

### Run Verification Script
```bash
node verify-site.js
```

**Expected Output: 10/10 tests passed**
| Test | Criteria |
|------|----------|
| Simulations loaded | 176 total |
| Quiz questions | All have 5+ questions |
| Real-life examples | All have examples |
| Local images | No external URLs |
| Image files exist | 0 missing |
| No attribution links | 0 found |
| Elementary appropriate | No algebra in arithmetic |
| Distinct area models | Unique images |
| Fraction content | Consistent |
| Asset folder | 70+ files |

---

## 2. BLACK BOX TESTING

Test the website as an end-user without knowledge of internal code.

### 2.1 Navigation Testing
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Home page loads | Visit `/phet-revamp/` | Grid of simulation cards |
| Filter by subject | Click "Physics" filter | Only physics sims shown |
| Filter by grade | Click "Elementary" | Only elementary sims |
| Search works | Type "area" in search | Area-related sims appear |
| Card click | Click any sim card | Navigate to sim page |
| Back button | Click browser back | Return to home |

### 2.2 Simulation Page Testing
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Page loads | Visit `/simulation/acid-base-solutions` | Full page renders |
| PhET iframe | Check simulation area | PhET sim loads in iframe |
| Real-life section | Scroll to examples | 2 cards with images |
| Images load | Check example cards | No broken images |
| Quiz section | Scroll to quiz | Quiz interface visible |

### 2.3 Quiz Functionality Testing
| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Start quiz | View quiz section | Question 1/5 shown |
| Answer correct | Click right answer | Green highlight, "Correct!" |
| Answer wrong | Click wrong answer | Red highlight, shows correct |
| Next question | Click "Next" | Question 2/5 shown |
| Complete quiz | Answer all 5 | Score screen appears |
| High score | Get 5/5 first time | Name entry prompt |
| Save score | Enter name, save | Leaderboard shows entry |
| Play again | Click "Play Again" | New random questions |
| View leaderboard | Click leaderboard | Tab view (Sim/Global) |

### 2.4 Responsive Testing
| Device | Resolution | Check |
|--------|------------|-------|
| Desktop | 1920x1080 | Full layout, 4-column grid |
| Laptop | 1366x768 | 3-column grid |
| Tablet | 768x1024 | 2-column grid |
| Mobile | 375x667 | 1-column, hamburger menu |

---

## 3. USER ACCEPTANCE TESTING (UAT)

### 3.1 Persona: Elementary Student (Age 8-10)
| Scenario | Acceptance Criteria |
|----------|---------------------|
| Find math game | Can locate "arithmetic" or "make-a-ten" |
| Understand examples | "Counting Coins" image shows actual coins |
| Take quiz | Questions are simple: "7 + 5 = ?" |
| Feel successful | Score message is encouraging |

### 3.2 Persona: Middle School Student (Age 11-14)
| Scenario | Acceptance Criteria |
|----------|---------------------|
| Find science sim | Can filter by "Physics" or "Chemistry" |
| Connect to real life | Examples are relatable (phones, cars) |
| Challenge level | Quiz requires thinking, not too easy |
| Compete | Can see leaderboard, wants to beat score |

### 3.3 Persona: Teacher
| Scenario | Acceptance Criteria |
|----------|---------------------|
| Find curriculum content | Can filter by grade level |
| Assign to class | Simulation loads reliably |
| Assess learning | Quiz covers key concepts |
| Professional appearance | No broken images, clean design |

---

## 4. CONTENT VERIFICATION

### 4.1 Image-Content Matching
For each simulation, verify image matches description:

```bash
# Check specific simulation
node -p "JSON.parse(require('fs').readFileSync('src/data/simulations.json')).simulations.find(s=>s.id==='arithmetic').realLifeExamples"
```

| Title | Image Must Show |
|-------|-----------------|
| "Counting Coins" | Actual coins/money |
| "Sharing Pizza" | Pizza slices |
| "Phone Charger" | Phone charging |
| "Floor Tiling" | Floor tiles |
| "Roller Coaster" | Roller coaster |

### 4.2 Age-Appropriate Content
| Grade | Allowed | Not Allowed |
|-------|---------|-------------|
| Elementary | 7+5=?, counting, shapes | y=mx+b, slope, calculus |
| Middle | V=IR, pH scale, forces | Advanced derivatives |
| High | Complex formulas OK | Inappropriate content |

### 4.3 Distinct Content for Similar Topics
Visit these URLs and confirm DIFFERENT images:
- `/simulation/area-model-algebra`
- `/simulation/area-model-decimals`
- `/simulation/area-model-introduction`
- `/simulation/circuit-construction-kit-ac`
- `/simulation/circuit-construction-kit-dc`

---

## 5. BROWSER-BASED ITERATION

### Systematic Page Check
Open browser and visit each simulation page:

```
http://localhost:3000/phet-revamp/simulation/SIMULATION_ID
```

**Check on EACH page:**
- [ ] Page loads without console errors
- [ ] PhET simulation iframe works
- [ ] Real Life Examples section visible
- [ ] Both example images load
- [ ] Images match their titles
- [ ] No "Image source" links visible
- [ ] Quiz section visible
- [ ] Quiz questions are topic-relevant
- [ ] Leaderboard functionality works

### Priority Simulations to Check
```
arithmetic, make-a-ten, fractions-intro,
area-model-algebra, area-model-decimals,
acid-base-solutions, forces-and-motion-basics,
circuit-construction-kit-ac, circuit-construction-kit-dc,
wave-on-a-string, energy-skate-park-basics
```

---

## 6. REGRESSION TESTING

After any code change, verify:
1. Run `node verify-site.js` - should pass 10/10
2. Check 3 random simulation pages
3. Complete one full quiz
4. Verify leaderboard saves

---

## 7. PERFORMANCE TESTING

| Metric | Target | How to Check |
|--------|--------|--------------|
| Page load | < 3 seconds | Browser DevTools > Network |
| Image size | < 500KB each | Check file sizes in assets |
| Quiz response | Instant | Click answers, observe delay |

---

## 8. ACCESSIBILITY TESTING

| Check | Tool/Method |
|-------|-------------|
| Keyboard nav | Tab through page |
| Color contrast | Chrome Lighthouse |
| Alt text | Check img elements |
| Screen reader | NVDA/VoiceOver test |

---

## Useful Commands

```bash
# Verify everything
node verify-site.js

# List all simulation IDs
node -p "JSON.parse(require('fs').readFileSync('src/data/simulations.json')).simulations.map(s=>s.id)"

# Count images
(Get-ChildItem public/assets/real-life).Count

# Check specific sim
node -p "JSON.parse(require('fs').readFileSync('src/data/simulations.json')).simulations.find(s=>s.id==='SIMULATION_ID')"

# Find sims missing examples
node -p "JSON.parse(require('fs').readFileSync('src/data/simulations.json')).simulations.filter(s=>!s.realLifeExamples||s.realLifeExamples.length<2).map(s=>s.id)"
```

---

## Issue Reporting Template

```
**Simulation ID:** 
**Issue Type:** [Content/Image/Quiz/UI]
**Description:** 
**Expected:** 
**Actual:** 
**Screenshot:** 
```
