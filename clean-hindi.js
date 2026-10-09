const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./hindi-literature-mcq-seed-final.json', 'utf8'));

// Matches any Hindi vowel sign or anusvara/visarga that is repeated 2 or more times
// and replaces it with a single instance.
const doubleMaatraRegex = /([\u093E-\u094C\u0902\u0903])\1+/g;

// Matches the specific double plural suffix ोंों (which is actually \u094B\u0902\u094B\u0902)
const doubleOAnusvara = /\u094B\u0902\u094B\u0902/g;

function cleanText(text) {
  if (!text) return text;
  return text
    .replace(doubleOAnusvara, '\u094B\u0902') // fix विकल्पोंों
    .replace(doubleMaatraRegex, '$1')         // fix ाा, ीी, etc.
    .replace(/विकल्पोंों/g, 'विकल्पों');      // just in case
}

let changedCount = 0;

data.questions.forEach(q => {
  const origQuestion = q.question;
  q.question = cleanText(q.question);
  
  let changed = (origQuestion !== q.question);
  
  if (q.options) {
    q.options.forEach(opt => {
      const origOpt = opt.text;
      opt.text = cleanText(opt.text);
      if (origOpt !== opt.text) changed = true;
    });
  }
  
  if (changed) changedCount++;
});

fs.writeFileSync('./hindi-literature-mcq-seed-final.json', JSON.stringify(data, null, 2));
console.log(`Cleaned Hindi OCR mishaps in ${changedCount} questions.`);
