import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACTIVE_META } from '../data/constants.js';
import { ensureAnonymousAuth } from '../firebase.js';
import { login } from '../services/roomService.js';

export default function MultiplayerLobby2(){
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const navigate=useNavigate();
  const submit=async()=>{
    setBusy(true); setError('');
    try { await ensureAnonymousAuth(); const session=await login(username,password); navigate(session.role==='host'?'/host':'/play'); }
    catch(e){setError(e.message||'Could not log in.');}
    finally{setBusy(false);}
  };
  return <div className="min-h-screen bg-[#fff8e7] flex items-center justify-center p-4">
    <div className="w-full max-w-lg rounded-[2rem] border-4 border-[#18233f] bg-white p-7 shadow-2xl">
      <div className="text-center">
        <div className="text-5xl">🎲</div>
        <p className="mt-3 text-xs font-black uppercase tracking-[.25em] text-[#ff8c4d]">{ACTIVE_META.title}</p>
        <h1 className="font-display text-4xl text-[#18233f]">Game Login</h1>
        <p className="mt-2 text-sm font-bold text-[#687187]">Use your assigned event username and password.</p>
      </div>
      <div className="mt-6 space-y-3">
        <input autoFocus value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="Username" autoComplete="username" maxLength={24} className="w-full rounded-xl border-4 border-[#18233f] px-4 py-4 font-bold outline-none"/>
        <input value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="Password" type="password" autoComplete="current-password" className="w-full rounded-xl border-4 border-[#18233f] px-4 py-4 font-bold outline-none"/>
        {error&&<div className="rounded-xl border-2 border-red-400 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}
        <button disabled={busy||!username.trim()||!password} onClick={submit} className="w-full rounded-xl border-4 border-[#18233f] bg-[#4dff79] py-4 text-lg font-black text-[#18233f] shadow-md disabled:opacity-40">{busy?'LOGGING IN…':'LOGIN'}</button>
      </div>
      <div className="mt-5 rounded-xl bg-[#fff8e7] p-4 text-center text-xs font-bold text-[#687187]">Single lobby • 1 host • up to 6 players</div>
    </div>
  </div>
}
