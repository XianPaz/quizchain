"use strict";

const {
  qtknForPlace,
  awardQuestionQtkn,
  compareArrival,
  ranksFromScores,
} = require("../shared/gameContract");

// Adapter over the shared game contract.
// Place among correct answers is server arrival order. Client clocks are ignored.

function scoreAnswers({ answers, correctIndex }) {
  const awarded = awardQuestionQtkn({ answers, correctIndex });
  const pointsByAddress = {};
  Object.entries(awarded).forEach(([address, result]) => {
    pointsByAddress[address] = {
      points: result.qtkn,
      qtkn: result.qtkn,
      place: result.place,
      correct: result.correct,
    };
  });
  return pointsByAddress;
}

function buildHighlights({ players, scores, answers, correctIndex, previousRanks, currentRanks }) {
  const nickname = {};
  (players || []).forEach((p) => {
    nickname[p.address] = p.name;
  });

  const ranks = currentRanks || ranksFromScores(scores);

  let fastest = null;
  Object.entries(answers || {}).forEach(([address, data]) => {
    if (data.answerIndex !== correctIndex) return;
    if (fastest === null || compareArrival(data, fastest) < 0) {
      fastest = {
        address,
        name: nickname[address] || address,
        responseTime: data.responseTime,
        arrivalSeq: data.arrivalSeq,
        receivedAt: data.receivedAt ?? data.answeredAt,
        points: scores[address]?.questionQtkn ?? scores[address]?.lastPoints ?? 0,
      };
    }
  });

  const streaks = Object.entries(scores)
    .filter(([, s]) => (s.streak || 0) >= 3)
    .map(([address, s]) => ({
      address,
      name: nickname[address] || address,
      streak: s.streak,
    }))
    .sort((a, b) => b.streak - a.streak);

  const climbers = Object.entries(ranks)
    .map(([address, toRank]) => {
      const fromRank = previousRanks?.[address];
      if (!fromRank) return null;
      const delta = fromRank - toRank;
      if (delta < 3) return null;
      return {
        address,
        name: nickname[address] || address,
        fromRank,
        toRank,
        delta,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.delta - a.delta);

  const podiumEntries = Object.entries(ranks)
    .filter(([address, toRank]) => {
      if (toRank > 3) return false;
      const fromRank = previousRanks?.[address];
      return !fromRank || fromRank > 3;
    })
    .map(([address, rank]) => ({
      address,
      name: nickname[address] || address,
      rank,
    }))
    .sort((a, b) => a.rank - b.rank);

  return { fastest, streaks, climbers, podiumEntries };
}

module.exports = {
  qtknForPlace,
  calcPlacementPoints: qtknForPlace,
  scoreAnswers,
  pointsToTokens: (qtkn) => Number(qtkn) || 0,
  ranksFromScores,
  buildHighlights,
};
