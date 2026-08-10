import { EVENT_QUESTIONS } from '../data/constants';
import { useState, useEffect } from 'react';

export default function QuestionTile({ tileType, onResolve }) {
  const [question, setQuestion] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [expiresAt, setExpiresAt] = useState(null);

  useEffect(() => {
    if (tileType === 'question' || tileType === 'normal') {
      const q = EVENT_QUESTIONS[Math.floor(Math.random() * EVENT_QUESTIONS.length)];
      setQuestion(q);
      setExpiresAt(new Date(Date.now() + 30000).toISOString());
    }
  }, [tileType]);

  const handleAnswer = (index) => {
    if (!question || answered || !expiresAt) return;
    const now = new Date();
    const expiry = new Date(expiresAt);
    if (now > expiry) {
      onResolve?.({ correct: false, reason: 'expired' });
      return;
    }
    const correct = index === question.answerIndex;
    setAnswered(true);
    onResolve?.({ correct, questionId: question.id });
  };

  if (!question) return null;

  return (
    <div className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-6 shadow-xl max-w-lg mx-auto text-center">
      <h3 className="font-display text-xl mb-2">Question Tile</h3>
      <p className="mb-4 text-lg font-bold">{question.prompt}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {question.choices.map((choice, idx) => (
          <button
            key={idx}
            onClick={() => handleAnswer(idx)}
            disabled={answered}
            className="px-4 py-2 rounded-xl border-4 border-[#1a1a2e] bg-[#fff8e7] font-bold hover:bg-[#ffea4d] disabled:opacity-50"
          >
            {choice}
          </button>
        ))}
      </div>
      {expiresAt && (
        <p className="mt-3 text-sm text-gray-600">Expires at server time: {new Date(expiresAt).toLocaleTimeString()}</p>
      )}
    </div>
  );
}
