import Board from '../components/Board.jsx';
import HostControls from '../components/HostControls.jsx';

export default function HostPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <Board />
      {/* Floating control panel */}
      <div className="absolute right-4 top-4 z-20 w-80">
        <HostControls />
      </div>
    </div>
  );
}
