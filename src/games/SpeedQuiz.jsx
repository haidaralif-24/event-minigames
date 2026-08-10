import { useState } from 'react';

export default function SpeedQuiz({ teamId, onFinish }) {
  const [answered, setAnswered] = useState(false);
  const [startTime] = useState(Date.now());

  const questions = [
    { prompt: "What color is the sky?", choices: ["Green", "Blue", "Red"], answer: 1 },
  ];
  const q = questions[0];

  const handleAnswer = (index) => {
    if (answered) return;
    setAnswered(true);
    const correct = index === q.answer;
    const elapsed = Date.now() - startTime;
    const score = correct ? Math.max(500, 1000 - elapsed) : 100;
    onFinish({ teamId, score });
  };

  return (
    <div className="text-center">
      <h2 className="text-2xl font-display mb-4">Speed Quiz</h2>
      <p className="mb-4 text-lg">{q.prompt}</p>
      <div className="flex gap-3 justify-center">
        {q.choices.map((c, i) => (
          <button
            key={i}
            onClick={() => handleAnswer(i)}
            disabled={answered}
            className="px-4 py-2 rounded-xl border-4 border-[#1a1a2e] bg-white font-bold hover:bg-[#ffea4d] disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
