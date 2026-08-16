/**
 * Buzzer Race question-game format.
 *
 * One question is shown to every team at once. Teams "buzz in" to claim
 * the right to answer; only the first team to buzz gets to submit an
 * answer. A wrong answer locks that team out of the *current* question
 * and reopens buzzing for whoever's left. The question resolves once
 * someone answers correctly, everyone gets locked out, or a timeout
 * fires.
 *
 * This module is a standalone library — it is NOT wired into
 * TurnEngine.jsx, Play.jsx, or HostControls.jsx. It has no React and no
 * Firestore dependency: just a state factory + a pure reducer, so it can
 * be plugged into the live game later (or driven by Firestore, or used
 * in a test) without rewriting the rules.
 *
 * Question shape (reused from src/data/rapidShootingQuestions.js):
 *   { id: string, question: string, options: string[], answer: number }
 *
 * State shape:
 *   {
 *     format: 'buzzer-race',
 *     status: 'idle' | 'question-open' | 'answering' | 'question-resolved' | 'finished',
 *     questions: Question[],
 *     questionIndex: number,
 *     teamIds: string[],
 *     buzzedTeamId: string | null,
 *     lockedOutTeamIds: string[],       // locked out for the CURRENT question only
 *     lastResolution: null | { correct: boolean, teamId: string | null, optionIndex?, points?, reason? },
 *     scores: { [teamId]: number },
 *     pointsPerCorrect: number,
 *     history: Array<{ questionIndex, teamId, optionIndex, correct }>,
 *   }
 */

import { rankByScore } from './shared.js';

export const BUZZER_RACE_ACTIONS = {
  START_QUESTION: 'START_QUESTION',
  BUZZ: 'BUZZ',
  ANSWER: 'ANSWER',
  TIMEOUT: 'TIMEOUT',
  NEXT_QUESTION: 'NEXT_QUESTION',
};

export function createInitialState(questions, teamIds, options = {}) {
  return {
    format: 'buzzer-race',
    status: 'idle',
    questions,
    questionIndex: 0,
    teamIds: [...teamIds],
    buzzedTeamId: null,
    lockedOutTeamIds: [],
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
    case BUZZER_RACE_ACTIONS.START_QUESTION: {
      if (state.status === 'finished') return state;
      return {
        ...state,
        status: 'question-open',
        buzzedTeamId: null,
        lockedOutTeamIds: [],
        lastResolution: null,
      };
    }

    case BUZZER_RACE_ACTIONS.BUZZ: {
      if (state.status !== 'question-open') return state;
      const { teamId } = action;
      if (state.lockedOutTeamIds.includes(teamId)) return state;
      return { ...state, status: 'answering', buzzedTeamId: teamId };
    }

    case BUZZER_RACE_ACTIONS.ANSWER: {
      if (state.status !== 'answering') return state;
      const { teamId, optionIndex } = action;
      if (teamId !== state.buzzedTeamId) return state;
      const question = currentQuestion(state);
      if (!question) return state;

      const correct = optionIndex === question.answer;
      const history = [
        ...state.history,
        { questionIndex: state.questionIndex, teamId, optionIndex, correct },
      ];

      if (correct) {
        const points = state.pointsPerCorrect;
        return {
          ...state,
          status: 'question-resolved',
          scores: { ...state.scores, [teamId]: (state.scores[teamId] || 0) + points },
          lastResolution: { correct: true, teamId, optionIndex, points },
          history,
        };
      }

      const lockedOutTeamIds = [...state.lockedOutTeamIds, teamId];
      const remaining = state.teamIds.filter((id) => !lockedOutTeamIds.includes(id));

      if (remaining.length === 0) {
        return {
          ...state,
          status: 'question-resolved',
          buzzedTeamId: null,
          lockedOutTeamIds,
          lastResolution: { correct: false, teamId: null, reason: 'all-locked-out' },
          history,
        };
      }

      return {
        ...state,
        status: 'question-open',
        buzzedTeamId: null,
        lockedOutTeamIds,
        history,
      };
    }

    case BUZZER_RACE_ACTIONS.TIMEOUT: {
      if (state.status !== 'question-open' && state.status !== 'answering') return state;
      return {
        ...state,
        status: 'question-resolved',
        buzzedTeamId: null,
        lastResolution: { correct: false, teamId: null, reason: 'timeout' },
      };
    }

    case BUZZER_RACE_ACTIONS.NEXT_QUESTION: {
      if (state.status !== 'question-resolved') return state;
      const nextIndex = state.questionIndex + 1;
      if (nextIndex >= state.questions.length) {
        return { ...state, status: 'finished', questionIndex: nextIndex };
      }
      return {
        ...state,
        status: 'idle',
        questionIndex: nextIndex,
        buzzedTeamId: null,
        lockedOutTeamIds: [],
        lastResolution: null,
      };
    }

    default:
      return state;
  }
}

/** null while the format is still running; a rankings summary once finished. */
export function getResult(state) {
  if (state.status !== 'finished') return { finished: false, rankings: null };
  return { finished: true, rankings: rankByScore(state.scores) };
}
