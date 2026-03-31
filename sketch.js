let cellSize = 10;
let columnCount;
let rowCount;

let currentCells = [];
let nextCells = [];

const dna = ["a", "t", "c", "g"];
let letters = [];
let trail = [];

const traits = {
  a: { stability: 0.01, fade: 0.95, boldBias: 0.6 },  // stable, holds form
  t: { stability: 0.06, fade: 0.75, boldBias: 0.2 },  // fragile, disappears quickly
  c: { stability: 0.12, fade: 0.85, boldBias: 0.5 },  // adaptive, mutates easily
  g: { stability: 0.02, fade: 0.97, boldBias: 0.4 }   // persistent in decay
};

let blooms = [];
let time = 0;

// Click parameters
const MAX_ACTIVE_BLOOMS = 150;
const BLOOM_LIFETIME = 15;
const CLICK_SEED_LIMIT = 5;
const FLOW_BIAS = 0.7;
let lastClickTime = 0;
const CLICK_COOLDOWN = 100; // ms

function setup() {
  frameRate(15);
  createCanvas(370, 370);

  columnCount = floor(width / cellSize);
  rowCount = floor(height / cellSize);

  for (let c = 0; c < columnCount; c++) {
    currentCells[c] = [];
    nextCells[c] = [];
    letters[c] = [];
    trail[c] = [];
    for (let r = 0; r < rowCount; r++) {
      currentCells[c][r] = 0;
      nextCells[c][r] = 0;
      letters[c][r] = "-";
      trail[c][r] = [];
    }
  }

  loop();
}

function draw() {
  time += 0.05;
  generate();
  propagateBlooms();

  background(255);
  textSize(cellSize);
  textAlign(CENTER, CENTER);

  for (let c = 0; c < columnCount; c++) {
    for (let r = 0; r < rowCount; r++) {
      let x = c * cellSize + cellSize / 2;
      let y = r * cellSize + cellSize / 2;

      // Draw fading trail
      if (trail[c][r]) {
        for (let i = trail[c][r].length - 1; i >= 0; i--) {
          let s = trail[c][r][i];
          fill(0, s.alpha);
          text(s.letter, x, y);
          s.alpha *= traits[s.letter]?.fade || 0.9;
          if (s.alpha < 1) trail[c][r].splice(i, 1);
        }
      }

      // Wave factor for boldness
      let wave =
        sin(c * 0.15 + time) +
        cos(r * 0.15 + time * 0.5) +
        sin((c + r) * 0.05 + time * 0.8);

      if (currentCells[c][r] === 1) {
        let letter = letters[c][r];
        let trait = traits[letter] || { boldBias: 0.4 };
        let isBold = wave + random() > 1 - trait.boldBias;

        textStyle(isBold ? BOLD : NORMAL);
        let jitter = random(-cellSize*0.3, cellSize*0.3);
        fill(constrain(0 + jitter, 0, 255));
        text(letter, x, y);

        if (!trail[c][r]) trail[c][r] = [];
        trail[c][r].push({ letter: letter, alpha: 120 });
      } else if (!trail[c][r] || trail[c][r].length === 0) {
        textStyle(NORMAL);
        fill(180);
        text("-", x, y);
      }
    }
  }
}

// Click to plant seeds with cooldown
function mousePressed() {
  if (millis() - lastClickTime < CLICK_COOLDOWN) return;
  lastClickTime = millis();

  let col = floor(mouseX / cellSize);
  let row = floor(mouseY / cellSize);

  for (let i = 0; i < CLICK_SEED_LIMIT; i++) {
    if (blooms.length < MAX_ACTIVE_BLOOMS) {
      blooms.push({
        col: col,
        row: row,
        steps: 0,
        delay: random(0, 3),
        dir: [random([-1,0,1]), random([-1,0,1])]
      });
    }
  }
}

// Organic bloom propagation
function propagateBlooms() {
  let newBlooms = [];

  for (let b of blooms) {
    b.delay -= 1;
    if (b.delay > 0) {
      newBlooms.push(b);
      continue;
    }

    let { col, row, steps, dir } = b;
    if (steps > BLOOM_LIFETIME) continue;

    if (currentCells[col][row] === 0) {
      currentCells[col][row] = 1;

      // Choose letter based on neighbors
      let neighborLetters = [];
      let neighbors = [
        [(col - 1 + columnCount) % columnCount, (row - 1 + rowCount) % rowCount],
        [col, (row - 1 + rowCount) % rowCount],
        [(col + 1) % columnCount, (row - 1 + rowCount) % rowCount],
        [(col - 1 + columnCount) % columnCount, row],
        [(col + 1) % columnCount, row],
        [(col - 1 + columnCount) % columnCount, (row + 1) % rowCount],
        [col, (row + 1) % rowCount],
        [(col + 1) % columnCount, (row + 1) % rowCount]
      ];

      for (let [c, r] of neighbors) {
        if (currentCells[c][r] === 1) neighborLetters.push(letters[c][r]);
      }

      let newLetter = neighborLetters.length > 0 ? random(neighborLetters) : random(dna);
      if (random() < traits[newLetter].stability) newLetter = random(dna);
      letters[col][row] = newLetter;

      if (!trail[col][row]) trail[col][row] = [];
      trail[col][row].push({ letter: newLetter, alpha: 120 });
    }

    // Propagation with directional bias
    let possibleDirs = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],          [1, 0],
      [-1, 1],  [0, 1], [1, 1]
    ];

    possibleDirs = possibleDirs.map(d => {
      let weight = d[0] === dir[0] && d[1] === dir[1] ? FLOW_BIAS : 1;
      return { d, weight };
    });

    for (let {d, weight} of possibleDirs) {
      if (random() < 0.35 * weight) {
        let c = (col + d[0] + columnCount) % columnCount;
        let r = (row + d[1] + rowCount) % rowCount;
        if (currentCells[c][r] === 0) {
          let newDir = [
            d[0] + floor(random(-1,2)),
            d[1] + floor(random(-1,2))
          ];
          newDir[0] = constrain(newDir[0], -1, 1);
          newDir[1] = constrain(newDir[1], -1, 1);
          newBlooms.push({
            col: c,
            row: r,
            steps: steps + random(0.5,1.5),
            delay: random(0,2),
            dir: newDir
          });
        }
      }
    }
  }

  blooms = newBlooms;
}

// Game of Life rules with letters
function generate() {
  let nextLetters = [];

  for (let c = 0; c < columnCount; c++) {
    nextLetters[c] = [];

    for (let r = 0; r < rowCount; r++) {
      let left = (c - 1 + columnCount) % columnCount;
      let right = (c + 1) % columnCount;
      let above = (r - 1 + rowCount) % rowCount;
      let below = (r + 1) % rowCount;

      let neighbours =
        currentCells[left][above] +
        currentCells[c][above] +
        currentCells[right][above] +
        currentCells[left][r] +
        currentCells[right][r] +
        currentCells[left][below] +
        currentCells[c][below] +
        currentCells[right][below];

      let currentState = currentCells[c][r];
      let currentLetter = letters[c][r];

      nextCells[c][r] = 0;
      nextLetters[c][r] = "-";

      if (currentState === 0 && neighbours === 3) {
        nextCells[c][r] = 1;
        let neighborLetters = [];
        let positions = [
          [left, above], [c, above], [right, above],
          [left, r],                 [right, r],
          [left, below], [c, below], [right, below]
        ];
        for (let [cx, ry] of positions) {
          if (currentCells[cx][ry] === 1) neighborLetters.push(letters[cx][ry]);
        }
        let inherited = neighborLetters.length > 0 ? random(neighborLetters) : random(dna);
        if (random() < traits[inherited].stability) inherited = random(dna);
        nextLetters[c][r] = inherited;
      } else if (currentState === 1 && (neighbours === 2 || neighbours === 3)) {
        nextCells[c][r] = 1;
        let letter = currentLetter;
        if (random() < traits[letter].stability) letter = random(dna);
        nextLetters[c][r] = letter;
      }
    }
  }

  currentCells = nextCells.map(arr => arr.slice());
  letters = nextLetters.map(arr => arr.slice());
}

