import { Routes, Route, Navigate } from 'react-router-dom';
import MultiplayerLobby from './pages/MultiplayerLobby2.jsx';
import MultiplayerHost from './pages/MultiplayerHost.jsx';
import MultiplayerPlay from './pages/MultiplayerPlay.jsx';
import SpectatorBoard from './pages/SpectatorBoard.jsx';
import Podium from './pages/Podium.jsx';
function Guard({role,children}){const session=(()=>{try{return JSON.parse(localStorage.getItem('event-minigame-player-session')||'null')}catch{return null}})();return session?.role===role&&session?.roomCode==='current'?children:<Navigate to="/" replace/>;}
export default function App(){return <Routes><Route path="/" element={<MultiplayerLobby/>}/><Route path="/lobby" element={<MultiplayerLobby/>}/><Route path="/host" element={<Guard role="host"><MultiplayerHost/></Guard>}/><Route path="/play" element={<Guard role="player"><MultiplayerPlay/></Guard>}/><Route path="/board" element={<SpectatorBoard/>}/><Route path="/podium" element={<Podium/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
