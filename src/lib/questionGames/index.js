/**
 * Question-games library — standalone, framework-agnostic game-state
 * logic for question-driven formats. See README.md in this folder for
 * usage notes and integration status.
 *
 * NOTE: nothing in this folder is wired into the live app yet
 * (TurnEngine.jsx / Play.jsx / HostControls.jsx are untouched).
 */

export * as BuzzerRace from './buzzerRace.js';
export * as EliminationTrivia from './eliminationTrivia.js';
export { shuffle, rankByScore } from './shared.js';
