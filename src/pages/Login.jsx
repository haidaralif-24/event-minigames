import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};

export default function LoginPage() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const val = input.trim().toLowerCase();
    const teamWords = ['one', 'two', 'three', 'four', 'five', 'six'];

    getSessionId();

    if (val === 'dadarzz') {
      sessionStorage.setItem('auth', 'host');
      sessionStorage.setItem('team', 'host');
      navigate('/host');
    } else if (teamWords.includes(val)) {
      const teamNum = teamWords.indexOf(val) + 1;
      const teamId = `team-${teamNum}`;
      sessionStorage.setItem('auth', 'team');
      sessionStorage.setItem('team', teamId);
      navigate('/play');
    } else {
      setError('Enter host password Dadarzz, or team word: one through six');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff8e7]">
      <form onSubmit={handleSubmit} className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-8 shadow-xl max-w-sm w-full text-center">
        <h1 className="font-display text-3xl mb-6">Party Board Game</h1>
        <p className="mb-4 text-sm text-gray-600">Host: Dadarzz | Team: one, two, three, four, five, six</p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter password or team word"
          className="w-full px-4 py-3 rounded-xl border-4 border-[#1a1a2e] mb-4 font-bold focus:outline-none focus:ring-4 focus:ring-[#4dff79]"
        />
        {error && <p className="text-red-600 mb-4 font-bold">{error}</p>}
        <button
          type="submit"
          className="w-full px-6 py-3 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md hover:scale-105 transition-transform"
        >
          Login
        </button>
      </form>
    </div>
  );
}
