/**
 * Shared helpers for the question-games library.
 *
 * These are intentionally framework-agnostic (no React, no Firestore) so
 * every format in this folder can reuse the same primitives.
 */

/** Fisher-Yates shuffle. Does not mutate the input array. */
export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Turns a { teamId: score } map into a ranked list, highest score first.
 * Ties are broken by teamId so ranking is deterministic (useful for tests).
 */
export function rankByScore(scores) {
  return Object.entries(scores)
    .sort(([teamA, a], [teamB, b]) => b - a || teamA.localeCompare(teamB))
    .map(([teamId, score], index) => ({ teamId, score, position: index + 1 }));
}
