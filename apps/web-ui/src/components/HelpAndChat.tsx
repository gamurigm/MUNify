'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ─── Help topics ─── */
const helpTopics = [
  { id: 'all', label: '📖 Guía Completa', file: '/help/guide.md' },
];

/* ─── Mini-chat message type ─── */
type Msg = { role: 'user' | 'assistant'; text: string };

/* ─── Pre-built FAQ answers (offline fallback) ─── */
const FAQ: Record<string, string> = {
  'position paper': 'Un **Position Paper** (Posición Oficial) expone la postura de un país frente al tema del comité. Incluye: Carta a la Mesa Directiva, Análisis Coyuntural, Posición Oficial y Bibliografía.',
  'resolución': 'Una **Resolución** propone soluciones a un problema. Tiene encabezado, cláusulas preambulatorias (con gerundios) y cláusulas operativas (numeradas, con verbos como *Insta*, *Recomienda*, *Decide*).',
  'enmienda': 'Una **Enmienda** es una modificación propuesta a una resolución existente. Puede agregar, eliminar o modificar cláusulas operativas.',
  'exportar': 'Para exportar, abre tu documento y haz clic en **"Exportar Oficial"**. El sistema compila el LaTeX a PDF automáticamente.',
  'comité': 'Puedes elegir entre 14 comités: Asamblea General, Consejo de Seguridad, ECOSOC, DISEC, SOCHUM, CIJ, ACNUR, UNICEF, G20, UNESCO, UNODC, OTAN, UNCTAD y ONU Mujeres.',
  'ia': 'Los agentes de IA realizan: 1) Investigación con Tavily, 2) Contexto legal, 3) Redacción LaTeX, 4) Validación protocolar, 5) Guía estratégica.',
  'lenguaje diplomático': 'Usa verbos como: *recomienda*, *insta*, *alienta*, *invita*, *solicita*. Evita: "prohibir", "obligar", "debe".',
  'cláusulas preambulatorias': 'Comienzan con gerundios: *Recordando*, *Reconociendo*, *Observando con preocupación*, *Reafirmando*, *Alarmado por*. Terminan en coma.',
  'cláusulas operativas': 'Se numeran y comienzan con verbos en presente: *Insta*, *Recomienda*, *Decide*, *Solicita*, *Establece*. Terminan en punto y coma, la última en punto.',
  'hola': '¡Hola! 👋 Soy el asistente de MUNify. Pregúntame sobre Position Papers, Resoluciones, comités de la ONU, o cómo usar la plataforma.',
  'ayuda': 'Puedo ayudarte con:\n- Cómo escribir un Position Paper\n- Estructura de resoluciones\n- Comités y competencias\n- Lenguaje diplomático\n- Exportar documentos\n- Usar los agentes de IA\n\n¡Pregunta lo que necesites!',
};

function findAnswer(query: string): string {
  const q = query.toLowerCase().trim();
  
  // Exact keyword match first
  for (const [key, answer] of Object.entries(FAQ)) {
    if (q.includes(key)) return answer;
  }
  
  // Fuzzy match
  if (q.includes('cómo') && q.includes('generar')) return FAQ['ia'];
  if (q.includes('paper') || q.includes('posición')) return FAQ['position paper'];
  if (q.includes('resol')) return FAQ['resolución'];
  if (q.includes('export') || q.includes('pdf')) return FAQ['exportar'];
  if (q.includes('comit') || q.includes('committee')) return FAQ['comité'];
  if (q.includes('claus') && q.includes('preamb')) return FAQ['cláusulas preambulatorias'];
  if (q.includes('claus') && q.includes('operat')) return FAQ['cláusulas operativas'];
  if (q.includes('diploma') || q.includes('lenguaje')) return FAQ['lenguaje diplomático'];
  if (q.includes('formato') || q.includes('latex')) return 'MUNify genera documentos en **LaTeX** compilable. El formato incluye portada, encabezados, secciones numeradas y bibliografía en español formal.';
  if (q.includes('consejo') && q.includes('seguridad')) return 'El **Consejo de Seguridad** mantiene la paz internacional, puede imponer sanciones y autorizar el uso de fuerza. Es el único órgano con resoluciones legalmente vinculantes.';
  if (q.includes('asamblea')) return 'La **Asamblea General** es el órgano deliberativo principal de la ONU. Los 193 Estados miembros debaten asuntos internacionales. Sus resoluciones generalmente **no** son vinculantes.';
  
  return 'No tengo una respuesta específica para esa pregunta, pero puedo ayudarte con temas de MUN. Prueba preguntar sobre:\n- Position Papers\n- Resoluciones\n- Comités de la ONU\n- Lenguaje diplomático\n- Exportar documentos';
}

export default function HelpAndChat() {
  const [activeTab, setActiveTab] = useState<'help' | 'chat'>('help');
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', text: '¡Hola! 👋 Soy el asistente de MUNify. Pregúntame sobre Position Papers, Resoluciones, comités, exportar PDF, o cualquier tema de MUN.' }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load markdown help
  useEffect(() => {
    fetch(helpTopics[0].file)
      .then(r => r.text())
      .then(text => { setMarkdown(text); setLoading(false); })
      .catch(() => { setMarkdown('# Error\nNo se pudo cargar la ayuda.'); setLoading(false); });
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || sending) return;
    
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    setSending(true);

    // Simulate short delay for natural feel
    await new Promise(r => setTimeout(r, 400 + Math.random() * 400));
    
    const answer = findAnswer(q);
    setMessages(prev => [...prev, { role: 'assistant', text: answer }]);
    setSending(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col rounded-2xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', height: '460px' }}>
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('help')}
          className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all"
          style={{
            background: activeTab === 'help' ? 'rgba(0,245,255,0.08)' : 'transparent',
            color: activeTab === 'help' ? '#00f5ff' : 'rgba(255,255,255,0.4)',
            borderBottom: activeTab === 'help' ? '2px solid #00f5ff' : '2px solid transparent',
          }}
        >
          📖 Ayuda
        </button>
        <button
          onClick={() => { setActiveTab('chat'); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all"
          style={{
            background: activeTab === 'chat' ? 'rgba(196,77,255,0.08)' : 'transparent',
            color: activeTab === 'chat' ? '#c44dff' : 'rgba(255,255,255,0.4)',
            borderBottom: activeTab === 'chat' ? '2px solid #c44dff' : '2px solid transparent',
          }}
        >
          💬 Asistente
        </button>
      </div>

      {/* Help tab */}
      {activeTab === 'help' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 help-markdown" style={{ scrollbarWidth: 'thin', scrollbarColor: '#00f5ff33 transparent' }}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 rounded-full border-2 border-t-[#00f5ff] border-white/10 animate-spin" />
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-lg font-bold mb-3 mt-1" style={{ color: '#00f5ff' }}>{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold mb-2 mt-4 uppercase tracking-wider" style={{ color: '#c44dff' }}>{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 mt-3 text-white/90">{children}</h3>,
                p: ({ children }) => <p className="text-xs text-white/60 mb-2 leading-relaxed">{children}</p>,
                li: ({ children }) => <li className="text-xs text-white/60 mb-1 ml-3 list-disc">{children}</li>,
                strong: ({ children }) => <strong className="text-white/90 font-semibold">{children}</strong>,
                em: ({ children }) => <em className="text-[#00f5ff]/70 not-italic font-medium">{children}</em>,
                hr: () => <hr className="border-white/10 my-4" />,
                blockquote: ({ children }) => (
                  <div className="border-l-2 border-[#c44dff]/50 pl-3 my-2 bg-[#c44dff]/5 rounded-r-lg py-2">
                    {children}
                  </div>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-lg border border-white/10">
                    <table className="w-full text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
                th: ({ children }) => <th className="text-left px-2 py-1.5 text-white/70 font-semibold border-b border-white/10 text-[10px] uppercase tracking-wider">{children}</th>,
                td: ({ children }) => <td className="px-2 py-1.5 text-white/50 border-b border-white/5">{children}</td>,
                code: ({ children }) => <code className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] text-[#00f5ff] font-mono">{children}</code>,
              }}
            >
              {markdown}
            </ReactMarkdown>
          )}
        </div>
      )}

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#c44dff33 transparent' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                  style={{
                    background: msg.role === 'user'
                      ? 'linear-gradient(135deg, #00f5ff20, #c44dff20)'
                      : 'rgba(255,255,255,0.05)',
                    border: msg.role === 'user'
                      ? '1px solid rgba(0,245,255,0.2)'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: msg.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="text-white/70 mb-1 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-white/90">{children}</strong>,
                      em: ({ children }) => <em className="text-[#00f5ff] not-italic">{children}</em>,
                      li: ({ children }) => <li className="text-white/60 ml-3 list-disc">{children}</li>,
                      code: ({ children }) => <code className="bg-white/10 px-1 rounded text-[#00f5ff] font-mono text-[10px]">{children}</code>,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl text-xs" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px 16px 16px 4px' }}>
                  <div className="flex gap-1 items-center text-white/30">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Pregunta sobre MUN..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#c44dff]/50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-30 hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #c44dff, #00f5ff)', color: '#040d21' }}
              >
                ➤
              </button>
            </div>
            <p className="text-[9px] text-white/20 mt-1.5 text-center">MUNify Assistant · Responde preguntas sobre MUN, documentos y la plataforma</p>
          </div>
        </div>
      )}
    </div>
  );
}
