import { copy } from "../copy/es-AR";

export function parseQuizCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);

  if (lines.length < 4) {
    throw new Error(copy.csv.tooShort);
  }

  const firstRow = parseCSVLine(lines[0]);
  if (firstRow[0].toLowerCase() !== "quiz_name") {
    throw new Error(copy.csv.missingQuizNameKey);
  }
  const quizName = firstRow[1]?.trim();
  if (!quizName) throw new Error(copy.csv.missingQuizName);

  const questionLines = lines.slice(3);
  if (questionLines.length === 0) {
    throw new Error(copy.csv.noQuestions);
  }

  const questions = questionLines.map((line, i) => {
    const cols = parseCSVLine(line);
    const rowNum = i + 4;

    const question = cols[0]?.trim();
    if (!question) throw new Error(copy.csv.missingQuestion(rowNum));

    // Collect options from columns 1 onwards until correct and time_limit
    // Format: question, opt_a, opt_b, [opt_c], [opt_d], [opt_e], [opt_f], correct, time_limit
    // correct is the first col that is A-F, time_limit is the col after that
    let correctIndex = -1;
    for (let c = 1; c < cols.length; c++) {
      const val = cols[c]?.trim().toUpperCase();
      if (["A", "B", "C", "D", "E", "F"].includes(val)) {
        correctIndex = c;
        break;
      }
    }

    if (correctIndex === -1) {
      throw new Error(copy.csv.missingCorrect(rowNum));
    }

    const options = cols.slice(1, correctIndex).map(o => o?.trim()).filter(Boolean);

    if (options.length < 2) {
      throw new Error(copy.csv.minOptions(rowNum));
    }
    if (options.length > 6) {
      throw new Error(copy.csv.maxOptions(rowNum));
    }

    const correctLetter = cols[correctIndex]?.trim().toUpperCase();
    const correctMap = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };
    const correctAnswerIndex = correctMap[correctLetter];

    if (correctAnswerIndex >= options.length) {
      throw new Error(copy.csv.correctMissingOption(rowNum, correctLetter));
    }

    const timeLimit = parseInt(cols[correctIndex + 1]);
    if (isNaN(timeLimit) || timeLimit < 5 || timeLimit > 120) {
      throw new Error(copy.csv.badTime(rowNum));
    }

    return {
      id: i + 1,
      question,
      options,
      correct: correctAnswerIndex,
      timeLimit,
    };
  });

  return { quizName, questions };
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}