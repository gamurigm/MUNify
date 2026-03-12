'use client';

interface AiAssistantPanelProps {
  isOpen: boolean;
}

export default function AiAssistantPanel({ isOpen }: AiAssistantPanelProps) {
  return (
    <aside 
      className={`transition-all duration-300 ease-in-out border-r border-white/10 bg-[#040d21]/60 backdrop-blur flex flex-col shrink-0 ${
        isOpen ? 'w-[320px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-none'
      }`}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[#00f5ff]">Agente Diplomático</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-end gap-4 text-sm">
        {/* Mocked AI Chat Message */}
        <div className="bg-[#00f5ff]/5 border border-[#00f5ff]/20 rounded-xl p-3 text-white/80 self-start max-w-[90%] shadow-[0_0_10px_rgba(0,245,255,0.05)]">
          <span className="text-[10px] font-bold text-[#00f5ff] uppercase block mb-1">Nvidia NIM (Llama 3)</span>
          Hola Delegado, ¿en qué te puedo ayudar hoy con tu resolución?
        </div>
      </div>
      
      <div className="p-4 border-t border-white/10 shrink-0">
        <input 
          type="text" 
          placeholder="Comunícate con la IA..." 
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs focus:border-[#00f5ff]/50 outline-none transition text-white/90"
          disabled
        />
      </div>
    </aside>
  );
}
