const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./hindi-literature-mcq-seed-final.json', 'utf8'));

data.questions.forEach(q => {
  if (q.options && q.options.length > 0) {
    // Reset all
    q.options.forEach(opt => { opt.isCorrect = false; });
    
    // Pick random index
    const randIndex = Math.floor(Math.random() * q.options.length);
    const correctOpt = q.options[randIndex];
    
    correctOpt.isCorrect = true;
    q.correctAnswer = correctOpt.id;
    q.correctAnswerText = correctOpt.text;
  }
});

fs.writeFileSync('./hindi-literature-mcq-seed-final.json', JSON.stringify(data, null, 2));
console.log('Randomized correct answers for all questions.');
