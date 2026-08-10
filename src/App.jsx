import { Routes, Route, Navigate } from 'react-router-dom';
import HostPage from './pages/Host.jsx';
import PlayPage from './pages/Play.jsx';
import BoardPage from './pages/Board.jsx';
import LoginPage from './pages/Login.jsx';

function RequireHost({ children }) {
  const auth = localStorage.getItem('auth');
  return auth === 'host' ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/host" element={<RequireHost><HostPage /></RequireHost>} />
      <Route path="/play" element={<RequireHost><PlayPage /></RequireHost>} />
      <Route path="/board" element={<RequireHost><BoardPage /></RequireHost>} />
    </Routes>
  );
}

export default App;
