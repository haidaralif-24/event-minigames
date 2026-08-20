import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, authPersistenceReady } from '../firebase';

const ACCOUNTS = {
  dadarzz: { role: 'host', email: 'host@event.app', team: 'host' },
  one: { role: 'team', email: 'team1@event.app', team: 'team-1' },
  two: { role: 'team', email: 'team2@event.app', team: 'team-2' },
  three: { role: 'team', email: 'team3@event.app', team: 'team-3' },
  four: { role: 'team', email: 'team4@event.app', team: 'team-4' },
  five: { role: 'team', email: 'team5@event.app', team: 'team-5' },
  six: { role: 'team', email: 'team6@event.app', team: 'team-6' },
};

function getSessionId() {
  let sessionId = sessionStorage.getItem('sessionId');
  if (!sessionId) { sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem('sessionId', sessionId); }
  return sessionId;
}
function friendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Invalid username or password.';
    case 'auth/too-many-requests': return 'Too many login attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed': return 'Email/password authentication is not enabled in Firebase yet.';
    default: return error?.message || 'Could not sign in right now.';
  }
}

export default function LoginPage() {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const navigate = useNavigate();
  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const account = ACCOUNTS[username.trim().toLowerCase()];
    if (!account) { setError('Host username: Dadarzz. Team usernames: one, two, three, four, five, or six.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try { await authPersistenceReady; await signInWithEmailAndPassword(auth, account.email, password); getSessionId(); sessionStorage.setItem('auth', account.role); sessionStorage.setItem('team', account.team); sessionStorage.setItem('authEmail', account.email); navigate(account.role === 'host' ? '/host' : '/play'); }
    catch (authError) { setError(friendlyAuthError(authError)); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen flex items-center justify-center bg-[#fff8e7] p-4"><form onSubmit={handleSubmit} className="bg-white border-4 border-[#1a1a2e] rounded-[2rem] p-8 shadow-xl max-w-md w-full text-center"><div className="mb-5 text-5xl">🎲</div><p className="text-xs font-black uppercase tracking-[0.25em] text-[#ff8c4d]">Adventure Island Night</p><h1 className="font-display text-4xl text-[#18233f] mt-1 mb-3">Join the Game</h1><p className="mb-6 text-sm font-semibold text-[#6d7890]">Use your event username and Firebase password.</p><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username: Dadarzz / one / two…" autoComplete="username" className="w-full px-4 py-3 rounded-xl border-4 border-[#1a1a2e] mb-3 font-bold focus:outline-none focus:ring-4 focus:ring-[#4dff79]" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" className="w-full px-4 py-3 rounded-xl border-4 border-[#1a1a2e] mb-4 font-bold focus:outline-none focus:ring-4 focus:ring-[#4dff79]" />{error && <p className="text-red-600 mb-4 font-bold text-sm">{error}</p>}<button type="submit" disabled={loading} className="w-full px-6 py-4 bg-[#4dff79] border-4 border-[#1a1a2e] rounded-xl font-black shadow-md disabled:opacity-60">{loading ? 'Signing in…' : 'ENTER GAME'}</button></form></div>;
}
