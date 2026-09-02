// node src/utils/parseQuizCSV.test.js
import assert from "node:assert/strict";
import { parseQuizCSV } from "./parseQuizCSV.js";

// Fila 2 va vacía en la plantilla, pero Google Sheets la exporta con las comas.
const HEAD = "quiz_name,Prueba\n,,,,,,\nquestion,option_a,option_b,option_c,option_d,correct,time_limit\n";

function parse(rows) {
  return parseQuizCSV(HEAD + rows.join("\n"));
}

// The letter in "correct" points at the column it names, not at a compacted list.
{
  const { questions } = parse(["¿Cuál?,uno,dos,tres,cuatro,C,20"]);
  assert.equal(questions[0].correct, 2);
  assert.deepEqual(questions[0].options, ["uno", "dos", "tres", "cuatro"]);
  assert.equal(questions[0].options[questions[0].correct], "tres");
}

// Unused columns at the end are allowed and do not move the correct answer.
{
  const { questions } = parse(["¿Cuál?,uno,dos,,,B,30"]);
  assert.deepEqual(questions[0].options, ["uno", "dos"]);
  assert.equal(questions[0].options[questions[0].correct], "dos");
}

// A blank column in the middle used to grade the class against the wrong option.
// It must be refused, not silently shifted.
{
  assert.throws(
    () => parse(["¿Cuál?,uno,,tres,cuatro,C,20"]),
    /opción B está vacía/,
    "una opción vacía en el medio tiene que dar error"
  );
}

// A letter with no column behind it is still refused.
{
  assert.throws(() => parse(["¿Cuál?,uno,dos,D,20"]), /apunta a una opción que no existe/);
}

// Six options still work, and F is the last one.
// Ojo: el buscador toma la primera columna que sea una letra A-F, así que una
// opción de una sola letra lo confundiría. Con texto real anda bien.
{
  const { questions } = parse(["¿Cuál?,uno,dos,tres,cuatro,cinco,seis,F,15"]);
  assert.equal(questions[0].options.length, 6);
  assert.equal(questions[0].options[questions[0].correct], "seis");
}

// Fila 2 vacía de verdad, sin comas: Excel y los archivos editados a mano la exportan
// así. Antes se perdía la primera pregunta en silencio.
{
  const text = "quiz_name,Prueba\n\nquestion,option_a,option_b,correct,time_limit\n"
    + "¿Una?,uno,dos,B,20\n¿Dos?,tres,cuatro,A,20";
  const { questions } = parseQuizCSV(text);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].question, "¿Una?");
  assert.equal(questions[1].question, "¿Dos?");
}

// Una fila vacía en el medio no corre la numeración de los mensajes de error.
{
  const text = "quiz_name,Prueba\n,,,,,,\nquestion,option_a,option_b,correct,time_limit\n"
    + "¿Una?,uno,dos,B,20\n\n¿Dos?,tres,D,20";
  assert.throws(() => parseQuizCSV(text), /Fila 6/);
}

// Con más de seis opciones el error habla del máximo, no de una letra inexistente.
{
  assert.throws(
    () => parse(["¿Cuál?,a1,b1,c1,d1,e1,f1,,h1,B,20"]),
    /como máximo 6 opciones/
  );
}

// Comillas dentro del texto: la planilla las exporta duplicadas. Antes
// desaparecían, y una coma dentro del campo corría todas las columnas.
{
  const text = HEAD + '"Dijo ""hola"", \u00bfy?",uno,dos,B,20';
  const { questions } = parseQuizCSV(text);
  assert.equal(questions[0].question, 'Dijo "hola", \u00bfy?');
  assert.deepEqual(questions[0].options, ["uno", "dos"]);
  assert.equal(questions[0].options[questions[0].correct], "dos");
  assert.equal(questions[0].timeLimit, 20);
}

console.log("parseQuizCSV.test.js passed");
