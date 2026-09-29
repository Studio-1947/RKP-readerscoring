export function parseQuizText(raw: string) {
  const lines = raw.split(/\r?\n/);
  const questions: Array<{ questionEn: string; questionHi: string; options: string[]; correctIndex: number }> = [];
  
  let currentQuestion: string | null = null;
  let options: string[] = [];
  let correctIndex = 0;
  
  function saveCurrent() {
    if (currentQuestion && options.length >= 2) {
      questions.push({
        questionHi: currentQuestion,
        questionEn: currentQuestion,
        options: [...options],
        correctIndex: correctIndex
      });
    }
  }
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    const startMatch = line.match(/^(\d+)\./);
    
    if (startMatch) {
      const num = parseInt(startMatch[1], 10);
      if (currentQuestion && options.length < 6 && num === options.length + 1) {
        let opt = line.replace(/^\d+\.[\s\t]*/, '').trim();
        if (opt.endsWith('#')) {
          correctIndex = options.length;
          opt = opt.slice(0, -1).trim();
        }
        options.push(opt);
        continue;
      }
    }
    
    if (currentQuestion && !startMatch && !line.match(/^\d+\./) && options.length < 6 && (options.length > 0 || line !== currentQuestion)) {
      let opt = line;
      if (opt.endsWith('#')) {
        correctIndex = options.length;
        opt = opt.slice(0, -1).trim();
      }
      options.push(opt);
      continue;
    }

    saveCurrent();
    
    currentQuestion = line.replace(/^\d+\.[\s\t]*/, '').trim();
    if (currentQuestion.startsWith("'") || currentQuestion.startsWith('"') || currentQuestion.startsWith('“')) {
      currentQuestion = currentQuestion.substring(1).trim();
    }
    options = [];
    correctIndex = 0;
  }
  
  saveCurrent();
  return questions;
}
