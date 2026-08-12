import Board from '../components/Board.jsx';
import HostControls from '../components/HostControls.jsx';

export default function HostPage() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#152033]">
      <main className="min-w-0 flex-1">
        <Board />
      </main>
      <aside className="z-30 flex h-full w-[340px] shrink-0 flex-col border-l-4 border-[#18233f] bg-[#f7f2df] shadow-2xl">
        <div className="border-b-2 border-[#18233f]/15 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#6d7890]">Party Board</p>
          <h1 className="font-display text-2xl text-[#18233f]">Game Control</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <HostControls />
        </div>
      </aside>
    </div>
  );
}
