'use client';

interface NotesPanelProps {
  isOpen: boolean;
}

export default function NotesPanel({ isOpen }: NotesPanelProps) {
  return (
    <aside 
      className={`transition-all duration-300 ease-in-out border-l border-white/10 bg-[#040d21]/60 backdrop-blur flex flex-col shrink-0 ${
        isOpen ? 'w-[320px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'
      }`}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#c44dff]">Tus Notas</h3>
      </div>
      
      <div className="flex-1 p-4 flex flex-col">
        <textarea 
          className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl p-4 text-xs font-mono text-white/70 outline-none resize-none focus:border-[#c44dff]/50 transition"
          placeholder="Escribe apuntes, cláusulas de otras delegaciones o datos clave para tu discurso aquí (Auto-guardado local)..."
        ></textarea>
      </div>
    </aside>
  );
}
