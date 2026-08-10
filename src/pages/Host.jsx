import Board from '../components/Board.jsx';
import QuestionTile from '../components/QuestionTile.jsx';

export default function HostPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eaddb8] to-[#c7e8a4]">
      <h1 className="text-center font-display text-4xl pt-6">Host View</h1>
      <Board />
      <div className="max-w-lg mx-auto my-8">
        <QuestionTile tileType="normal" />
      </div>
    </div>
  );
}
