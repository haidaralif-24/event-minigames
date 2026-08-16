/**
 * Manual sanity-check script for the question-games library.
 * Not part of the app build — run it directly with Node:
 *
 *   node src/lib/questionGames/demo.js
 *
 * It exercises both formats against a tiny in-memory question set so you
 * can see the state machine work without wiring anything into the UI.
 */

import { BuzzerRace, EliminationTrivia } from './index.js';

const sampleQuestions = [
  { id: 'q1', question: 'Sample question 1?', options: ['A', 'B', 'C', 'D'], answer: 1 },
  { id: 'q2', question: 'Sample question 2?', options: ['A', 'B', 'C', 'D'], answer: 0 },
];
const teamIds = ['team-1', 'team-2', 'team-3'];

console.log('--- Buzzer Race demo ---');
let buzzer = BuzzerRace.createInitialState(sampleQuestions, teamIds);
const B = BuzzerRace.BUZZER_RACE_ACTIONS;

buzzer = BuzzerRace.reducer(buzzer, { type: B.START_QUESTION });
buzzer = BuzzerRace.reducer(buzzer, { type: B.BUZZ, teamId: 'team-2' });
buzzer = BuzzerRace.reducer(buzzer, { type: B.ANSWER, teamId: 'team-2', optionIndex: 1 }); // correct
buzzer = BuzzerRace.reducer(buzzer, { type: B.NEXT_QUESTION });

buzzer = BuzzerRace.reducer(buzzer, { type: B.START_QUESTION });
buzzer = BuzzerRace.reducer(buzzer, { type: B.BUZZ, teamId: 'team-1' });
buzzer = BuzzerRace.reducer(buzzer, { type: B.ANSWER, teamId: 'team-1', optionIndex: 3 }); // wrong, locked out
buzzer = BuzzerRace.reducer(buzzer, { type: B.BUZZ, teamId: 'team-3' });
buzzer = BuzzerRace.reducer(buzzer, { type: B.ANSWER, teamId: 'team-3', optionIndex: 0 }); // correct
buzzer = BuzzerRace.reducer(buzzer, { type: B.NEXT_QUESTION });

console.log('scores:', buzzer.scores);
console.log('result:', BuzzerRace.getResult(buzzer));

console.log('\n--- Elimination Trivia demo ---');
let elim = EliminationTrivia.createInitialState(sampleQuestions, teamIds);
const E = EliminationTrivia.ELIMINATION_TRIVIA_ACTIONS;

elim = EliminationTrivia.reducer(elim, { type: E.START_QUESTION });
elim = EliminationTrivia.reducer(elim, { type: E.ANSWER, teamId: 'team-1', optionIndex: 1 }); // correct
elim = EliminationTrivia.reducer(elim, { type: E.ANSWER, teamId: 'team-2', optionIndex: 3 }); // wrong
elim = EliminationTrivia.reducer(elim, { type: E.ANSWER, teamId: 'team-3', optionIndex: 1 }); // correct
elim = EliminationTrivia.reducer(elim, { type: E.RESOLVE_QUESTION });
console.log('after Q1 — active:', elim.activeTeamIds, '| status:', elim.status);

if (elim.status === 'question-resolved') {
  elim = EliminationTrivia.reducer(elim, { type: E.NEXT_QUESTION });
  elim = EliminationTrivia.reducer(elim, { type: E.START_QUESTION });
  elim = EliminationTrivia.reducer(elim, { type: E.ANSWER, teamId: 'team-1', optionIndex: 0 }); // correct
  elim = EliminationTrivia.reducer(elim, { type: E.ANSWER, teamId: 'team-3', optionIndex: 2 }); // wrong
  elim = EliminationTrivia.reducer(elim, { type: E.RESOLVE_QUESTION });
}

console.log('final — active:', elim.activeTeamIds, '| status:', elim.status);
console.log('result:', EliminationTrivia.getResult(elim));
