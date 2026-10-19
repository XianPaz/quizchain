import { copy } from "../copy/es-AR.js";

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

export function parseQuizCSV(text) {
  // Keep every line, including blanks. Row 2 of the template is empty and some
  // programs export it with no commas at all; dropping it silently swallowed the
  // first question and made every row number in an error message wrong.
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map(l => l.trim());
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length < 4) {
    throw new Error(copy.csv.tooShort);
  }

  const firstRow = parseCSVLine(lines[0]);
  if (firstRow[0].toLowerCase() !== "quiz_name") {
    throw new Error(copy.csv.missingQuizNameKey);
  }
  const quizName = firstRow[1]?.trim();
  if (!quizName) throw new Error(copy.csv.missingQuizName);

  // Row numbers are kept so an error points at the row of the spreadsheet.
  const questionLines = lines
    .slice(3)
    .map((line, i) => ({ line, rowNum: i + 4 }))
    .filter(({ line }) => line !== "" && line.replace(/,/g, "") !== "");

  if (questionLines.length === 0) {
    throw new Error(copy.csv.noQuestions);
  }

  const questions = questionLines.map(({ line, rowNum }, i) => {
    const cols = parseCSVLine(line);

    const question = cols[0]?.trim();
    if (!question) throw new Error(copy.csv.missingQuestion(rowNum));

    // Collect options from columns 1 onwards until correct and time_limit
    // Format: question, opt_a, opt_b, [opt_c], [opt_d], [opt_e], [opt_f], correct, time_limit
    // correct is the first col that is A-F, time_limit is the col after that
    let correctIndex = -1;
    for (let c = 1; c < cols.length; c++) {
      const val = cols[c]?.trim().toUpperCase();
      if (OPTION_LETTERS.includes(val)) {
        correctIndex = c;
        break;
      }
    }

    if (correctIndex === -1) {
      throw new Error(copy.csv.missingCorrect(rowNum));
    }

    // The letter in "correct" points at a column, so the columns must keep their
    // places. Only trailing blanks are dropped ("las que no uses, vacías"); a blank
    // in the middle used to shift every option after it and mark the wrong answer.
    const options = cols.slice(1, correctIndex).map(o => (o ?? "").trim());
    while (options.length > 0 && options[options.length - 1] === "") {
      options.pop();
    }

    if (options.length < 2) {
      throw new Error(copy.csv.minOptions(rowNum));
    }
    if (options.length > OPTION_LETTERS.length) {
      throw new Error(copy.csv.maxOptions(rowNum));
    }

    const blankAt = options.indexOf("");
    if (blankAt !== -1) {
      throw new Error(copy.csv.blankOption(rowNum, OPTION_LETTERS[blankAt]));
    }

    const correctLetter = cols[correctIndex]?.trim().toUpperCase();
    const correctAnswerIndex = OPTION_LETTERS.indexOf(correctLetter);

    if (correctAnswerIndex === -1 || correctAnswerIndex >= options.length) {
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

// CSV estándar: dentro de un campo entre comillas, dos comillas seguidas son una
// comilla literal. Tratar cada comilla como un interruptor borraba las comillas
// del texto y, peor, podía salir del modo entre comillas en el lugar equivocado y
// partir el campo en una coma interna, corriendo todas las columnas siguientes.
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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