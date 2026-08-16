/**
 * Elimination Trivia question-game format.
 *
 * Sequential questions, every still-active team answers each one. A wrong
 * answer eliminates that team for the rest of THIS ROUND only — they stay
 * eliminated until a new round is started with a fresh
 * createInitialState() call, they are not removed from the overall game.
 * The round ends when one team remains or the question set runs out.
 *
 * This module is a standalone library — it is NOT wired into
 * TurnEngine.jsx, Play.jsx, or HostControls.jsx. No React, no Firestore:
 * just a state factory + a pure reducer.
 *
 * Question shape (reused from src/data/rapidShootingQuestions.js):
 *   { id: string, question: string, options: string[], answer: number }
 *
 * State shape:
 *   {
 *     format: 'elimination-trivia',
 *     status: 'idle' | 'question-open' | 'question-resolved' | 'round-finished',
 *     questions: Question[],
 *     questionIndex: number,
 *     teamIds: string[],                // everyone who started the round
 *     activeTeamIds: string[],          // still alive this round
 *     eliminatedTeamIds: string[],      // eliminated this round, in elimination order
 *     currentAnswers: { [teamId]: number },  // cleared every question
 *     lastResolution: null | { correctTeamIds: string[], eliminatedTeamIds: string[] },
 *     scores: { [teamId]: number },
 *     pointsPerCorrect: number,
 *     history: Array<{ questionIndex, answers, correctTeamIds, eliminatedTeamIds }>,
 *   }
 */

import { rankByScore } from './shared.js';

export const ELIMINATION_TRIVIA_ACTIONS = {
  START_QUESTION: 'START_QUESTION',
  ANSWER: 'ANSWER',
  RESOLVE_QUESTION: 'RESOLVE_QUESTION',
  NEXT_QUESTION: 'NEXT_QUESTION',
};

export function createInitialState(questions, teamIds, options = {}) {
  return {
    format: 'elimination-trivia',
    status: 'idle',
    questions,
    questionIndex: 0,
    teamIds: [...teamIds],
    activeTeamIds: [...teamIds],
    eliminatedTeamIds: [],
    currentAnswers: {},
    lastResolution: null,
    scores: Object.fromEntries(teamIds.map((id) => [id, 0])),
    pointsPerCorrect: options.pointsPerCorrect ?? 100,
    history: [],
  };
}

function currentQuestion(state) {
  return state.questions[state.questionIndex] || null;
}

/** Pure reducer: (state, action) -> nextState. Never mutates `state`. */
export function reducer(state, action) {
  switch (action.type) {
    case ELIMINATION_TRIVIA_ACTIONS.START_QUESTION: {
      if (state.status === 'round-finished') return state;
      return { ...state, status: 'question-open', currentAnswers: {}, lastResolution: null };
    }

    case ELIMINATION_TRIVIA_ACTIONS.ANSWER: {
      if (state.status !== 'question-open') return state;
      const { teamId, optionIndex } = action;
      if (!state.activeTeamIds.includes(teamId)) return state;
      if (state.currentAnswers[teamId] !== undefined) return state;
      return { ...state, currentAnswers: { ...state.currentAnswers, [teamId]: optionIndex } };
    }

    case ELIMINATION_TRIVIA_ACTIONS.RESOLVE_QUESTION: {
      if (state.status !== 'question-open') return state;
      const question = currentQuestion(state);
      if (!question) return state;

      const correctTeamIds = [];
      const eliminatedThisQuestion = [];
      const scores = { ...state.scores };

      state.activeTeamIds.forEach((teamId) => {
        const optionIndex = state.currentAnswers[teamId];
        const correct = optionIndex === question.answer;
        if (correct) {
          correctTeamIds.push(teamId);
          scores[teamId] = (scores[teamId] || 0) + state.pointsPerCorrect;
        } else {
          // Not answering in time counts as wrong, same as a wrong pick.
          eliminatedThisQuestion.push(teamId);
        }
      });

      const stillActive = state.activeTeamIds.filter((id) => !eliminatedThisQuestion.includes(id));
      const eliminatedTeamIds = [...state.eliminatedTeamIds, ...eliminatedThisQuestion];
      const history = [
        ...state.history,
        {
          questionIndex: state.questionIndex,
          answers: state.currentAnswers,
          correctTeamIds,
          eliminatedTeamIds: eliminatedThisQuestion,
        },
      ];

      const isLastQuestion = state.questionIndex >= state.questions.length - 1;
      const roundFinished = stillActive.length <= 1 || isLastQuestion;

      return {
        ...state,
        status: roundFinished ? 'round-finished' : 'question-resolved',
        activeTeamIds: stillActive,
        eliminatedTeamIds,
        scores,
        lastResolution: { correctTeamIds, eliminatedTeamIds: eliminatedThisQuestion },
        history,
      };
    }

    case ELIMINATION_TRIVIA_ACTIONS.NEXT_QUESTION: {
      if (state.status !== 'question-resolved') return state;
      return { ...state, status: 'idle', questionIndex: state.questionIndex + 1, currentAnswers: {} };
    }

    default:
      return state;
  }
}

/**
 * null while the round is still running; once finished, a full ranking:
 * a sole survivor (if any) is always rank 1, everyone else ranked by score.
 */
export function getResult(state) {
  if (state.status !== 'round-finished') return { finished: false, rankings: null, survivor: null };

  if (state.activeTeamIds.length === 1) {
    const survivor = state.activeTeamIds[0];
    const rest = rankByScore(
      Object.fromEntries(Object.entries(state.scores).filter(([id]) => id !== survivor)),
    ).map((entry) => ({ ...entry, position: entry.position + 1 }));
    return {
      finished: true,
      survivor,
      rankings: [{ teamId: survivor, score: state.scores[survivor] || 0, position: 1 }, ...rest],
    };
  }

  // Question set exhausted without a sole survivor: active teams are ranked
  // by score first, eliminated teams fill in the remaining places after them.
  const activeRanked = rankByScore(
    Object.fromEntries(Object.entries(state.scores).filter(([id]) => state.activeTeamIds.includes(id))),
  );
  const eliminatedRanked = rankByScore(
    Object.fromEntries(Object.entries(state.scores).filter(([id]) => state.eliminatedTeamIds.includes(id))),
  ).map((entry) => ({ ...entry, position: entry.position + activeRanked.length }));

  return { finished: true, survivor: null, rankings: [...activeRanked, ...eliminatedRanked] };
}
