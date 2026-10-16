"use strict";

const assert = require("assert");
const {
  WORDS,
  normalizeRoomCode,
  isValidRoomCode,
  parseRoomCode,
  generateRoomCode,
} = require("./roomCodes");

assert.strictEqual(WORDS.length, 2048);
assert.ok(WORDS.includes("cactus"));
assert.ok(WORDS.includes("maple"));

// generation: two valid BIP-39 words
const generated = generateRoomCode(() => false);
assert.ok(isValidRoomCode(generated), `generated invalid code: ${generated}`);
const generatedWords = generated.split(" ");
assert.strictEqual(generatedWords.length, 2);
assert.ok(WORDS.includes(generatedWords[0]));
assert.ok(WORDS.includes(generatedWords[1]));

// collisions: isTaken returns true once, then false — generator retries
let takenCalls = 0;
const afterCollision = generateRoomCode(() => {
  takenCalls += 1;
  return takenCalls === 1;
});
assert.ok(isValidRoomCode(afterCollision));
assert.strictEqual(takenCalls, 2);

// exhausted retries throw
assert.throws(
  () => generateRoomCode(() => true),
  /unique room code/
);

// normalization of spaces, hyphens, case
assert.strictEqual(normalizeRoomCode("cactus maple"), "cactus maple");
assert.strictEqual(normalizeRoomCode("Cactus Maple"), "cactus maple");
assert.strictEqual(normalizeRoomCode("cactus-maple"), "cactus maple");
assert.strictEqual(normalizeRoomCode("  cactus   maple  "), "cactus maple");
assert.strictEqual(normalizeRoomCode("Cactus-MAPLE"), "cactus maple");
assert.strictEqual(normalizeRoomCode("cactus—maple"), "cactus—maple");

// lookup
assert.strictEqual(parseRoomCode("cactus maple"), "cactus maple");
assert.strictEqual(parseRoomCode("Cactus Maple"), "cactus maple");
assert.strictEqual(parseRoomCode("cactus-maple"), "cactus maple");
assert.strictEqual(parseRoomCode("  cactus   maple  "), "cactus maple");
assert.strictEqual(parseRoomCode("Cactus-Maple"), "cactus maple");
assert.strictEqual(parseRoomCode("abandon ability"), "abandon ability");

// same word twice is allowed
assert.strictEqual(parseRoomCode("cactus cactus"), "cactus cactus");
assert.ok(isValidRoomCode("maple maple"));

// invalid codes
assert.strictEqual(isValidRoomCode("cactus"), false);
assert.strictEqual(parseRoomCode("cactus"), null);
assert.strictEqual(isValidRoomCode("cactus maple zebra"), false);
assert.strictEqual(parseRoomCode("cactus maple zebra"), null);
assert.strictEqual(isValidRoomCode("cactus notaword"), false);
assert.strictEqual(parseRoomCode("cactus notaword"), null);
assert.strictEqual(isValidRoomCode(""), false);
assert.strictEqual(parseRoomCode(""), null);
assert.strictEqual(isValidRoomCode("   "), false);
assert.strictEqual(parseRoomCode(null), null);
assert.strictEqual(isValidRoomCode("123 456"), false);
assert.strictEqual(parseRoomCode("123 456"), null);
assert.strictEqual(isValidRoomCode("AB12CD"), false);
assert.strictEqual(parseRoomCode("cactus maple!"), null);

// two simultaneous rooms get different codes
const taken = new Set();
const roomA = generateRoomCode((code) => taken.has(code));
taken.add(roomA);
const roomB = generateRoomCode((code) => taken.has(code));
taken.add(roomB);
assert.notStrictEqual(roomA, roomB);
assert.ok(isValidRoomCode(roomA));
assert.ok(isValidRoomCode(roomB));

console.log("roomCodes.test.js: all tests passed");
