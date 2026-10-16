"use strict";

const { randomInt } = require("crypto");
const WORDS = require("./wordlists/bip39-english.json");

const WORD_SET = new Set(WORDS);
const MAX_GENERATE_ATTEMPTS = 64;

function normalizeRoomCode(input) {
  return String(input ?? "")
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isValidRoomCode(input) {
  const words = normalizeRoomCode(input).split(" ");
  return words.length === 2 && WORD_SET.has(words[0]) && WORD_SET.has(words[1]);
}

function parseRoomCode(input) {
  const normalized = normalizeRoomCode(input);
  return isValidRoomCode(normalized) ? normalized : null;
}

function generateRoomCode(isTaken) {
  if (typeof isTaken !== "function") {
    throw new TypeError("generateRoomCode(isTaken) requires an isTaken(code) function");
  }

  for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const code = `${WORDS[randomInt(WORDS.length)]} ${WORDS[randomInt(WORDS.length)]}`;
    if (!isTaken(code)) return code;
  }

  throw new Error(`Unable to generate a unique room code after ${MAX_GENERATE_ATTEMPTS} attempts`);
}

module.exports = {
  WORDS,
  normalizeRoomCode,
  isValidRoomCode,
  parseRoomCode,
  generateRoomCode,
};
