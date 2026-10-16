// Order and place both come from the server. It ranks with ties (1, 2, 2, 4) and
// pays QTKN by that same rank, so reading the place off the array index would show
// two tied students in different places than the tokens they actually get.
export function rankedScores(scores) {
  return Object.entries(scores || {})
    .map(([address, s]) => ({ address, ...s }))
    .sort((a, b) => {
      const byRank = (a.rank ?? Infinity) - (b.rank ?? Infinity);
      if (byRank !== 0) return byRank;
      const byQtkn = (b.totalQtkn ?? b.totalTokens ?? 0) - (a.totalQtkn ?? a.totalTokens ?? 0);
      if (byQtkn !== 0) return byQtkn;
      const byCorrect = (b.correct ?? 0) - (a.correct ?? 0);
      if (byCorrect !== 0) return byCorrect;
      return a.address.localeCompare(b.address);
    });
}
