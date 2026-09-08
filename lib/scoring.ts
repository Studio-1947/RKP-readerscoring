export type ReadingScore = {
  total: number;
  accuracy: number;
  fluency: number;
  completion: number;
  consistency: number;
  wordsRead: number;
  expectedWords: number;
  wordsPerMinute: number;
  xp: number;
};

/** Normalizes only presentation differences before word-level Hindi alignment. */
export function normalizeHindi(text: string) {
  return text
    .normalize("NFC")
    .toLocaleLowerCase("hi-IN")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[।॥,;:!?"“”'‘’()\[\]{}—–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string) {
  const normalized = normalizeHindi(text);
  return normalized ? normalized.split(" ") : [];
}

function wordDistance(expected: string[], spoken: string[]) {
  const previous = Array.from({ length: spoken.length + 1 }, (_, index) => index);
  for (let row = 1; row <= expected.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= spoken.length; column += 1) {
      const substitute = previous[column - 1] + (expected[row - 1] === spoken[column - 1] ? 0 : 1);
      current[column] = Math.min(previous[column] + 1, current[column - 1] + 1, substitute);
    }
    for (let index = 0; index < current.length; index += 1) previous[index] = current[index];
  }
  return previous[spoken.length];
}

export function scoreReading(referenceText: string, transcript: string, elapsedSeconds: number, attemptNumber: number): ReadingScore {
  const expected = words(referenceText);
  const spoken = words(transcript);
  const distance = wordDistance(expected, spoken);
  const accuracy = expected.length ? Math.max(0, Math.round((1 - distance / expected.length) * 100)) : 0;
  const completion = expected.length ? Math.min(100, Math.round((spoken.length / expected.length) * 100)) : 0;
  const minutes = Math.max(elapsedSeconds / 60, 0.15);
  const wordsPerMinute = Math.round(spoken.length / minutes);
  // 95–135 WPM is a comfortable Hindi literary-reading band. The score tapers outside it.
  const fluency = spoken.length < 5 ? 0 : Math.max(0, Math.round(100 - Math.abs(wordsPerMinute - 115) * 1.45));
  const consistency = Math.max(50, 100 - Math.max(0, attemptNumber - 1) * 12);
  const total = Math.round(accuracy * 0.65 + fluency * 0.2 + completion * 0.1 + consistency * 0.05);
  const xp = Math.round(total * 1.5 + (total >= 80 ? 20 : 0));

  return { total, accuracy, fluency, completion, consistency, wordsRead: spoken.length, expectedWords: expected.length, wordsPerMinute, xp };
}
