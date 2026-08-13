import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, authPersistenceReady } from '../firebase';

const ACCOUNTS = {
  dadarzz: { role: 'host', email: 'host@event-minigames.app', team: 'host', label: 'Host' },
  one: { role: 'team', email: 'team1@event-minigames.app', team: 'team-1', label: 'Team One' },
  two: { role: 'team', email: 'team2@event-minigames.app', team: 'team-2', label: 'Team Two' },
  three: { role: 'team', email: 'team3@event-minigames.app', team: 'team-3', label: 'Team Three' },
  four: { role: 'team', email: 'team4@event-minigames.app', team: 'team-4', label: 'Team Four' },
  five: { role: 'team', email: 'team5@event-minigames.app', team: 'team-5', label: 'Team Five' },
  six: { role: 'team', email: 'team6@event-minigames.app', team: 'team-6', label: 'Team Six' },
};

function getSessionId() {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
}

function friendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid username or password.';
    case 'auth/too-many-requests':
      return 'Too many login attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/password authentication is not enabled in Firebase yet.';
    default:
      return error?.message || 'Could not sign in right now.';
  }
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const account = ACCOUNTS[username.trim().toLowerCase()];

    if (!account) {
      setError('Use Dadarzz for the host, or one through six for a team.');
      return;
    }
    if (!password) {
      setError('Enter your Firebase account password.');
      return;
    }

    setLoading(true);
    try {
      await authPersistenceReady;
      await signInWithEmailAndPassword(auth, account.email, password);
      getSessionId();
      sessionStorage.setItem('auth', account.role);
      sessionStorage.setItem('team', account.team);
      sessionStorage.setItem('authEmail', account.email);
      navigate(account.role === 'host' ? '/host' : '/play');
    } catch (authError) {
      setError(friendlyAuthError(authError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff8e7] p-4">
      <form onSubmit={handleSubmit} className="bg-white border-4 border-[#1a1a2e] rounded-3xl p-8 shadow-xl max-w-sm w-full text-center">
        <h1 className="font-display text-3xl mb-2">Party Board Game</h1>
        <p className="mb-6 text-sm text-gray-600">Firebase-authenticated game session</p>

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username (Dadarzz / one / two...)"
          autoComplete="username"
          className="w-full px-4 py-3 rounded-xl border-4 border-[#1a1a2e] mb-3 font-bold focus:outline-none focus:ring-4 focus:ring-[#4dff79]"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Firebase password"
          autoComplete="current-password"
          className="w-full px-4 py-3 rounded-xl border-4 border-[#1a1a2e] mb-4 font-bold focus:outline-none focus:ring-4 focus:ring-[#4dff79]"
        />

        {error && <p className="text-red-600 mb-4 font-bold text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
        >
          {loading ? 'Signing in…' : 'Login'}
        </button>
      </form>
    </div>
  );
}
