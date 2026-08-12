import { Routes, Route, Navigate } from 'react-router-dom';
import HostPage from './pages/Host.jsx';
import PlayPage from './pages/Play.jsx';
import BoardPage from './pages/Board.jsx';
import LoginPage from './pages/Login.jsx';

function RequireHost({ children }) {
  return sessionStorage.getItem('auth') === 'host' ? children : <Navigate to="/" replace />;
}

function RequireTeam({ children }) {
  return sessionStorage.getItem('auth') === 'team' ? children : <Navigate to="/" replace />;
}

function RequireAny({ children }) {
  const auth = sessionStorage.getItem('auth');
  return (auth === 'host' || auth === 'team') ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/host" element={<RequireHost><HostPage /></RequireHost>} />
      <Route path="/play" element={<RequireTeam><PlayPage /></RequireTeam>} />
      <Route path="/board" element={<RequireAny><BoardPage /></RequireAny>} />
    </Routes>
  );
}

export default App;
