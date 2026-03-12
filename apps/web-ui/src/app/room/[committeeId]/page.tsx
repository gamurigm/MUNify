'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import mammoth from 'mammoth';

/* ───────── Committee data ───────── */
const COMMITTEES: Record<string, { name: string; sub: string; color: string }> = {
  GA: { name: 'Asamblea General', sub: 'General Assembly', color: '#00f5ff' },
  SC: { name: 'Consejo de Seguridad', sub: 'Security Council', color: '#c44dff' },
  EC: { name: 'Consejo Económico y Social', sub: 'ECOSOC', color: '#00f5ff' },
  DC: { name: 'Comité de Desarme', sub: 'DISEC', color: '#c44dff' },
  SH: { name: 'SOCHUM', sub: 'Social, Cultural y Humanitario', color: '#00f5ff' },
  CJ: { name: 'Corte Internacional', sub: 'CIJ / ICJ', color: '#c44dff' },
  AC: { name: 'ACNUR', sub: 'Alto Comisionado para los Refugiados', color: '#00f5ff' },
  UF: { name: 'UNICEF', sub: 'Fondo para la Infancia', color: '#c44dff' },
  G2: { name: 'G20', sub: 'Grupo de los Veinte', color: '#00f5ff' },
  US: { name: 'UNESCO', sub: 'Educación, Ciencia y Cultura', color: '#c44dff' },
  UD: { name: 'UNODC', sub: 'Droga y Delito', color: '#00f5ff' },
  OT: { name: 'OTAN', sub: 'Organización del Tratado del Atlántico Norte', color: '#c44dff' },
  UC: { name: 'UNCTAD', sub: 'Comercio y Desarrollo', color: '#00f5ff' },
  OM: { name: 'ONU Mujeres', sub: 'Igualdad de Género', color: '#c44dff' },
};

/* ───────── Countries ───────── */
const INITIAL_COUNTRIES = [
  { code: 'us', name: 'Estados Unidos' }, { code: 'gb', name: 'Reino Unido' },
  { code: 'fr', name: 'Francia' }, { code: 'de', name: 'Alemania' },
  { code: 'cn', name: 'China' }, { code: 'ru', name: 'Rusia' },
  { code: 'jp', name: 'Japón' }, { code: 'br', name: 'Brasil' },
  { code: 'mx', name: 'México' }, { code: 'ar', name: 'Argentina' },
  { code: 'co', name: 'Colombia' }, { code: 'in', name: 'India' },
  { code: 'za', name: 'Sudáfrica' }, { code: 'ng', name: 'Nigeria' },
  { code: 'eg', name: 'Egipto' }, { code: 'sa', name: 'Arabia Saudita' },
  { code: 'au', name: 'Australia' }, { code: 'kr', name: 'Corea del Sur' },
  { code: 'ca', name: 'Canadá' }, { code: 'it', name: 'Italia' },
  { code: 'es', name: 'España' }, { code: 'tr', name: 'Turquía' },
  { code: 'il', name: 'Israel' }, { code: 'ir', name: 'Irán' },
  { code: 'pk', name: 'Pakistán' }, { code: 'id', name: 'Indonesia' },
  { code: 'se', name: 'Suecia' }, { code: 'no', name: 'Noruega' },
  { code: 'ch', name: 'Suiza' }, { code: 'pl', name: 'Polonia' },
  { code: 'ua', name: 'Ucrania' }, { code: 'cl', name: 'Chile' },
  { code: 'pe', name: 'Perú' }, { code: 've', name: 'Venezuela' },
  { code: 'cu', name: 'Cuba' }, { code: 'ke', name: 'Kenia' },
  { code: 'et', name: 'Etiopía' }, { code: 'gh', name: 'Ghana' },
  { code: 'th', name: 'Tailandia' }, { code: 'vn', name: 'Vietnam' },
  { code: 'ph', name: 'Filipinas' }, { code: 'my', name: 'Malasia' },
  { code: 'bd', name: 'Bangladés' }, { code: 'nl', name: 'Países Bajos' },
  { code: 'be', name: 'Bélgica' }, { code: 'at', name: 'Austria' },
  { code: 'pt', name: 'Portugal' }, { code: 'gr', name: 'Grecia' },
  { code: 'ie', name: 'Irlanda' }, { code: 'nz', name: 'Nueva Zelanda' },
];

/* ───────── Utils ───────── */
function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const COMMON_COUNTRY_MAP: Record<string, string> = {
  'bolivia': 'bo', 'venezuela': 've', 'palestina': 'ps', 'corea del norte': 'kp',
  'corea del sur': 'kr', 'vaticano': 'va', 'suiza': 'ch', 'holanda': 'nl',
  'paises bajos': 'nl', 'irlanda': 'ie', 'reino unido': 'gb', 'estados unidos': 'us'
};

export default function RoomPage() {
  const router = useRouter();
  const { committeeId } = useParams() as { committeeId: string };
  const committee = useMemo(() => COMMITTEES[committeeId] || { name: committeeId, sub: '', color: '#00f5ff' }, [committeeId]);
  const accentColor = committee.color;

  /* ── Layout states ── */
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [timerMinimized, setTimerMinimized] = useState(true);
  const [timelineMinimized, setTimelineMinimized] = useState(true);
  const [focusMode, setFocusMode] = useState(false);

  /* ── Session Timer ── */
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionRunning, setSessionRunning] = useState(false);
  useEffect(() => {
    let interval: any;
    if (sessionRunning) interval = setInterval(() => setSessionSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionRunning]);

  /* ── Countries Management (Persistent) ── */
  const [allCountries, setAllCountries] = useState(INITIAL_COUNTRIES);
  const [newCountryName, setNewCountryName] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    const savedCustom = localStorage.getItem(`room_${committeeId}_custom_countries`);
    const savedPresence = localStorage.getItem(`room_${committeeId}_presence`);
    if (savedCustom) setAllCountries(prev => [...JSON.parse(savedCustom), ...prev]);
    if (savedPresence) setParticipants(JSON.parse(savedPresence));
  }, [committeeId]);

  const toggleParticipant = (code: string) => {
    const newPresence = participants.includes(code) ? participants.filter(c => c !== code) : [...participants, code];
    setParticipants(newPresence);
    localStorage.setItem(`room_${committeeId}_presence`, JSON.stringify(newPresence));
  };

  const addNewCountry = async () => {
    if (!newCountryName.trim()) return;
    const nameLower = newCountryName.toLowerCase().trim();
    let code = 'custom-' + Math.random().toString(36).substr(2, 4);
    if (COMMON_COUNTRY_MAP[nameLower]) {
      code = COMMON_COUNTRY_MAP[nameLower];
    } else {
      try {
        const res = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(nameLower)}?fields=cca2`);
        if (res.ok) {
          const data = await res.json();
          if (data && data[0]?.cca2) code = data[0].cca2.toLowerCase();
        }
      } catch (e) { console.error('Flag search failed', e); }
    }
    const newCountry = { code, name: newCountryName.trim() };
    setAllCountries(prev => [newCountry, ...prev]);
    const currentCustom = JSON.parse(localStorage.getItem(`room_${committeeId}_custom_countries`) || '[]');
    localStorage.setItem(`room_${committeeId}_custom_countries`, JSON.stringify([newCountry, ...currentCustom]));
    setNewCountryName('');
  };

  const simpleMajority = Math.floor(participants.length / 2) + 1;
  const qualifiedMajority = Math.ceil((participants.length * 2) / 3);

  /* ── Speakers ── */
  const [speakers, setSpeakers] = useState<{ code: string; name: string }[]>([]);
  const [currentSpeakerIdx, setCurrentSpeakerIdx] = useState(0);
  const addToSpeakers = (country: { code: string; name: string }) => setSpeakers(prev => [...prev, country]);
  const nextSpeaker = () => {
    if (speakers.length > 0) {
      setCurrentSpeakerIdx(p => (p + 1) % speakers.length);
      setSwSeconds(0);
      setSwRunning(false);
    }
  };

  /* ── Speech Timer ── */
  const [swSeconds, setSwSeconds] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [swLimit, setSwLimit] = useState(60);
  useEffect(() => {
    let interval: any;
    if (swRunning) interval = setInterval(() => setSwSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [swRunning]);

  /* ── Document Center (Persistent PDFs & DOCXs) ── */
  const [documents, setDocuments] = useState<{ id: string; title: string; blob?: Blob; url?: string; type: 'pdf' | 'docx'; html?: string }[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const request = indexedDB.open('MUNifyDB', 3); // Bump version again to force upgrade
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('docs')) {
        db.createObjectStore('docs', { keyPath: 'id' });
      }
      // Cleanup old store name if it exists from previous version
      if (db.objectStoreNames.contains('pdfs')) {
        db.deleteObjectStore('pdfs');
      }
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      
      // Robustness check: avoid transaction if store doesn't exist
      if (!db.objectStoreNames.contains('docs')) return;

      const transaction = db.transaction('docs', 'readonly');
      const store = transaction.objectStore('docs');
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        const savedDocs = getAllRequest.result.map((doc: any) => ({
          ...doc,
          url: doc.type === 'pdf' ? URL.createObjectURL(doc.blob) : undefined
        }));
        if (savedDocs.length > 0) {
          setDocuments(savedDocs);
          setActiveDocId(savedDocs[0].id);
        }
      };
    };
  }, []);

  const saveToDB = (doc: any) => {
    const request = indexedDB.open('MUNifyDB', 3);
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('docs')) return;
      const transaction = db.transaction('docs', 'readwrite');
      const store = transaction.objectStore('docs');
      store.put(doc);
    };
  };

  const removeFromDB = (id: string) => {
    const request = indexedDB.open('MUNifyDB', 3);
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('docs')) return;
      const transaction = db.transaction('docs', 'readwrite');
      const store = transaction.objectStore('docs');
      store.delete(id);
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const id = 'doc-' + Math.random().toString(36).substr(2, 7);
      if (file.type === 'application/pdf') {
        const newDoc: any = { id, title: file.name, blob: file, type: 'pdf' };
        saveToDB(newDoc);
        setDocuments(prev => [...prev, { ...newDoc, url: URL.createObjectURL(file) }]);
        setActiveDocId(id);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const newDoc: any = { id, title: file.name, html: result.value, type: 'docx' };
        saveToDB(newDoc);
        setDocuments(prev => [...prev, newDoc]);
        setActiveDocId(id);
      }
    }
    e.target.value = '';
  };

  const closeDoc = (id: string) => {
    const docToClose = documents.find(d => d.id === id);
    if (docToClose?.url) URL.revokeObjectURL(docToClose.url);
    removeFromDB(id);
    const newDocs = documents.filter(doc => doc.id !== id);
    setDocuments(newDocs);
    if (activeDocId === id) setActiveDocId(newDocs.length > 0 ? newDocs[0].id : null);
  };

  const activeDoc = useMemo(() => documents.find(d => d.id === activeDocId) || null, [documents, activeDocId]);

  /* ── Notes ── */
  const [notes, setNotes] = useState('');
  const [noteCategory, setNoteCategory] = useState('General');
  const [search, setSearch] = useState('');
  const [activities, setActivities] = useState<{ id: string; label: string; time: number; type: string; color?: string }[]>([
    { id: '1', label: 'Introducción', time: 0, type: 'fase', color: '#00f5ff' },
    { id: '2', label: 'Pase de Lista', time: 0, type: 'fase', color: '#c44dff' },
    { id: '3', label: 'GSL (Lista General de Oradores)', time: 0, type: 'fase', color: '#00f5ff' }
  ]);
  const addActivity = (label: string, type: string = 'motion', color?: string) => {
    const newId = Math.random().toString(36).substr(2, 9);
    setActivities(prev => [...prev, { id: newId, label, time: sessionSeconds, type, color }]);
  };
  const filteredCountries = allCountries.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-screen text-white bg-[#020617] relative overflow-hidden flex flex-col font-sans selection:bg-cyan-500/30">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-10" style={{ background: accentColor }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-10" style={{ background: '#c44dff' }} />
      </div>

      <header className="relative z-50 h-14 border-b border-white/5 bg-[#020617]/80 backdrop-blur-3xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/')} className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition">←</button>
          <div className="flex flex-col">
            <h1 className="text-base font-black tracking-tight uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor }} />
              {committee.name}
            </h1>
            <span className="text-[9px] font-bold text-white/20 tracking-widest uppercase">{committee.sub}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push(`/room/${committeeId}/drafting`)}
            className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition border bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500 hover:text-white"
          >
            Drafting Studio
          </button>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <div className="flex items-center gap-4 px-4 py-1.5 rounded-2xl bg-white/[0.03] border border-white/5">
            <span className="font-mono text-lg font-black tabular-nums tracking-tighter" style={{ color: accentColor }}>{formatTime(sessionSeconds)}</span>
            <button onClick={() => setSessionRunning(!sessionRunning)} className="w-8 h-8 rounded-lg flex items-center justify-center transition hover:scale-105 active:scale-95" style={{ background: sessionRunning ? '#ef4444' : accentColor, color: '#020617' }}>{sessionRunning ? '⏸' : '▶'}</button>
          </div>
          <button onClick={() => setFocusMode(!focusMode)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition border ${focusMode ? 'bg-white text-black' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'}`}>
            {focusMode ? 'Escritorio' : 'Modo Enfoque'}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex p-2 gap-2 overflow-hidden min-h-0">
        <aside className={`transition-all duration-500 flex flex-col gap-2 shrink-0 ${focusMode || !leftOpen ? 'w-0 opacity-0 pointer-events-none' : 'w-64'}`}>
          <div className="flex-1 rounded-[32px] border border-white/5 bg-white/[0.02] backdrop-blur-3xl flex flex-col overflow-hidden shadow-2xl relative">
            <div className="p-4 border-b border-white/5 bg-white/[0.01]">
              <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase tracking-widest text-cyan-400/60">
                <span>Sesión / Quórum</span>
                <button onClick={() => setLeftOpen(false)} className="text-white/20 hover:text-white">✕</button>
              </div>
              <input type="text" placeholder="Filtrar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full h-8 bg-black/40 border border-white/5 rounded-xl px-3 text-[10px] outline-none focus:border-cyan-500/30 transition mb-2" />
              <div className="flex gap-1.5">
                <input type="text" placeholder="Manu..." value={newCountryName} onChange={e => setNewCountryName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNewCountry()} className="flex-1 h-7 bg-white/5 border border-white/5 rounded-lg px-2 text-[9px] outline-none font-medium" />
                <button onClick={addNewCountry} className="w-7 h-7 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition">+</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
              {filteredCountries.map(c => {
                const isPresent = participants.includes(c.code);
                return (
                  <div key={c.code} className="group flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 transition cursor-pointer" onClick={() => toggleParticipant(c.code)}>
                    <div className={`w-3.5 h-3.5 rounded-sm border transition flex items-center justify-center shrink-0 ${isPresent ? 'bg-white border-white' : 'border-white/10'}`}>
                      {isPresent && <span className="text-black text-[9px] font-black">✓</span>}
                    </div>
                    {c.code.startsWith('custom-') ? <div className="w-4 h-3 flex items-center justify-center text-[7px] bg-white/10 rounded-sm italic opacity-40">M</div> : <img src={`https://flagcdn.com/w40/${c.code}.png`} className="w-4 h-3 rounded-sm object-cover" alt="" />}
                    <span className={`text-[9px] font-bold truncate ${isPresent ? 'text-white' : 'text-white/20'}`}>{c.name}</span>
                    {isPresent && <button onClick={(e) => { e.stopPropagation(); addToSpeakers(c); }} className="ml-auto opacity-0 group-hover:opacity-100 w-5 h-5 rounded-md bg-cyan-500/10 text-cyan-400 flex items-center justify-center hover:bg-cyan-500 hover:text-white transition">🎤</button>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="h-32 rounded-[32px] border border-white/5 bg-white/[0.01] backdrop-blur-3xl p-4 flex flex-col justify-center space-y-2 shrink-0">
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/20">
               <span>Pase de Lista</span>
               <span className="text-white/60">{participants.length}</span>
             </div>
             <div className="h-px bg-white/5" />
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-purple-400/40">
               <span>Simple (+1)</span>
               <span className="text-purple-400/80">{simpleMajority}</span>
             </div>
             <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-amber-400/40">
               <span>Calificada</span>
               <span className="text-amber-400/80">{qualifiedMajority}</span>
             </div>
          </div>
        </aside>

        <section className={`transition-all duration-500 flex flex-col gap-2 min-w-0 flex-1 overflow-hidden h-full`}>
          <div className={`transition-all duration-500 overflow-hidden shrink-0 ${timerMinimized ? 'h-10' : 'h-52'}`}>
            <div className="h-full rounded-[28px] border border-white/10 bg-gradient-to-br from-[#021021]/80 to-[#020617]/95 backdrop-blur-3xl shadow-2xl flex flex-col">
               {timerMinimized ? (
                 <button onClick={() => setTimerMinimized(false)} className="w-full h-full flex items-center justify-between px-6 hover:bg-white/5 transition group">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">Reloj de Oratoria</span>
                    <div className="flex items-center gap-4">
                       <span className="font-mono text-base font-black tabular-nums" style={{ color: swRunning ? accentColor : 'white' }}>{formatTime(swSeconds)}</span>
                       <span className="text-[8px] font-bold text-white/10 uppercase group-hover:text-white/30 border border-white/10 px-2 py-1 rounded-full">Expandir</span>
                    </div>
                 </button>
               ) : (
                 <>
                    <header className="flex justify-between items-center px-6 py-2 shrink-0 border-b border-white/5">
                      <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Speech Module v2</span>
                      <button onClick={() => setTimerMinimized(true)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition leading-none text-xs">✕</button>
                    </header>
                    <div className="flex-1 flex items-center px-8 gap-8 min-h-0 overflow-hidden">
                       <div className="flex-1 flex flex-col items-center justify-center">
                          <div className="font-mono text-7xl font-black tabular-nums tracking-tighter" style={{ color: 'white', textShadow: swRunning ? `0 0 40px ${accentColor}55` : 'none' }}>
                            {formatTime(swSeconds)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black text-white/10 uppercase tracking-widest">Límite:</span>
                            <input type="number" value={swLimit} onChange={e => setSwLimit(Number(e.target.value))} className="w-10 bg-white/5 border border-white/5 rounded h-5 text-[9px] font-bold outline-none text-center" />
                          </div>
                       </div>
                       <div className="w-56 h-24 rounded-[24px] bg-white/[0.02] border border-white/10 flex items-center gap-4 px-6 relative shrink-0">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-sm" style={{ backgroundColor: accentColor }} />
                          {speakers[currentSpeakerIdx] ? (
                            <>
                               <img src={`https://flagcdn.com/w40/${speakers[currentSpeakerIdx].code}.png`} className="w-10 h-7 rounded-sm shadow-md" alt="" />
                               <div className="flex flex-col min-w-0">
                                  <span className="text-[8px] font-black text-white/20 uppercase mb-0.5">Orador</span>
                                  <h6 className="text-xs font-black truncate tracking-tight">{speakers[currentSpeakerIdx].name}</h6>
                               </div>
                            </>
                          ) : (
                            <span className="w-full text-center text-[9px] font-black text-white/10 uppercase">En espera</span>
                          )}
                       </div>
                    </div>
                    <div className="p-3 bg-white/[0.02] border-t border-white/5 rounded-b-[28px] flex gap-2 shrink-0">
                       <button onClick={() => setSwRunning(!swRunning)} className="flex-1 h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl transition active:scale-95" style={{ background: swRunning ? '#ef4444' : `linear-gradient(135deg, ${accentColor}, #c44dff)`, color: swRunning ? '#fff' : '#020617' }}>{swRunning ? 'Pausa' : 'Comenzar'}</button>
                       <button onClick={() => {setSwRunning(false); setSwSeconds(0);}} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-lg hover:bg-white/10 transition">↺</button>
                       <button onClick={nextSpeaker} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-lg hover:bg-white/10 transition">→</button>
                    </div>
                 </>
               )}
            </div>
          </div>

          <div className="flex-1 rounded-[32px] border border-white/10 bg-[#020617]/40 shadow-inner flex flex-col overflow-hidden min-h-0 relative">
             <header className="px-5 py-2.5 flex items-center justify-between border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 mr-4 py-0.5">
                   {documents.map(doc => (
                     <button key={doc.id} onClick={() => setActiveDocId(doc.id)} className={`h-8 px-4 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border shrink-0 ${activeDocId === doc.id ? 'bg-white text-black border-white' : 'bg-white/5 text-white/30 border-white/5 hover:bg-white/10'}`}>
                        {doc.type === 'pdf' ? '📄' : '📝'} {doc.title.length > 20 ? doc.title.substring(0, 17) + '...' : doc.title}
                        <span onClick={(e) => { e.stopPropagation(); closeDoc(doc.id); }} className="hover:text-red-500 transition-colors opacity-30">✕</span>
                     </button>
                   ))}
                   <input type="file" multiple accept="application/pdf,.docx" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                   <button onClick={() => fileInputRef.current?.click()} className="h-8 px-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-black text-[8px] uppercase tracking-widest hover:bg-cyan-400 hover:text-black transition-all shrink-0 ml-2">Cargar Archivos</button>
                </div>
                <div className="text-[8px] font-black text-white/10 uppercase tracking-[0.5em] shrink-0">Document Center</div>
             </header>

             <div className="flex-1 flex flex-col bg-[#0f172a] relative h-full">
                {activeDoc ? (
                   activeDoc.type === 'pdf' ? (
                     <iframe src={`${activeDoc.url}#toolbar=0&navpanes=0&scrollbar=0`} className="absolute inset-0 w-full h-full border-none" title={activeDoc.title} />
                   ) : (
                     <div className="absolute inset-0 w-full h-full overflow-y-auto p-12 bg-white text-black custom-scrollbar selection:bg-cyan-200">
                        <div className="max-w-3xl mx-auto prose prose-sm" dangerouslySetInnerHTML={{ __html: activeDoc.html || '' }} />
                     </div>
                   )
                ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                      <div className="w-16 h-16 rounded-full border border-white/5 flex items-center justify-center mb-6 opacity-20 text-4xl">📁</div>
                      <h3 className="text-base font-black text-white/20 uppercase tracking-widest mb-1">Visor de Archivos</h3>
                      <p className="text-[9px] text-white/10 font-bold max-w-[200px] leading-relaxed">Soporta PDF y Word (.docx). Tus archivos se guardan localmente para la próxima sesión.</p>
                   </div>
                )}
             </div>
          </div>
          
          <div className={`transition-all duration-500 overflow-hidden shrink-0 ${timelineMinimized ? 'h-10' : 'h-40'}`}>
            <div className="h-full rounded-[28px] border border-white/5 bg-white/[0.01] flex flex-col shadow-inner overflow-hidden">
               {timelineMinimized ? (
                  <button onClick={() => setTimelineMinimized(false)} className="w-full h-full flex items-center justify-between px-8 hover:bg-white/5 transition group">
                      <span className="text-[8px] font-black text-white/10 uppercase tracking-widest group-hover:text-white/20">Progreso de Sesión</span>
                      <span className="text-[8px] font-black text-white/5 group-hover:text-white/20 transition uppercase tracking-widest">Roadmap Activo</span>
                      <span className="text-[8px] font-black text-white/10 uppercase group-hover:text-white/30 border border-white/10 px-2 py-1 rounded-full">Expandir</span>
                  </button>
               ) : (
                  <>
                    <div className="px-6 py-2 flex justify-between items-center border-b border-white/5 bg-white/[0.01]">
                       <h4 className="text-[8px] font-black uppercase tracking-widest text-white/20">Cronología</h4>
                       <div className="flex gap-1.5 items-center">
                          <button onClick={() => addActivity('Caucus Mod.', 'motion', '#00f5ff')} className="h-7 px-3 rounded-lg bg-white/5 text-[8px] font-black uppercase">Caucus Mod.</button>
                          <button onClick={() => addActivity('Caucus Simp.', 'motion', '#c44dff')} className="h-7 px-3 rounded-lg bg-white/5 text-[8px] font-black uppercase">Caucus Simp.</button>
                          <button onClick={() => setTimelineMinimized(true)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition text-xs ml-1">✕</button>
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-3 relative custom-scrollbar">
                       <div className="absolute left-[39px] top-6 bottom-6 w-px bg-white/[0.03]" />
                       <div className="space-y-4 pb-2">
                         {activities.map((a, i) => (
                           <div key={a.id} className={`flex items-start gap-6 transition-all duration-700 ${i === activities.length - 1 ? 'opacity-100' : 'opacity-20 hover:opacity-100'}`}>
                             <div className="relative z-10 w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center bg-[#020617] border" style={{ borderColor: a.color || '#fff' }}>
                                <span className="text-[9px] font-black" style={{ color: a.color || '#fff' }}>{formatTime(a.time)}</span>
                             </div>
                             <div className="flex flex-col py-0.5">
                               <h5 className="text-[10px] font-black truncate">{a.label}</h5>
                               <span className="text-[7px] font-bold text-white/10 uppercase">{a.type}</span>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  </>
               )}
            </div>
          </div>
        </section>

        <section className={`transition-all duration-500 flex flex-col gap-2 shrink-0 ${rightOpen ? (focusMode ? 'flex-1' : 'w-[440px]') : 'w-0 opacity-0 pointer-events-none'}`}>
          <div className="flex-1 rounded-[32px] border border-white/5 bg-[#021021]/60 backdrop-blur-3xl flex flex-col overflow-hidden shadow-2xl relative">
            <div className={`p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]`}>
               <h2 className="text-[10px] font-black uppercase tracking-widest text-white/20">Escritorio del Delegado</h2>
               <div className="flex gap-1.5">
                  {['General', 'Discursos'].map(cat => (
                    <button key={cat} onClick={() => setNoteCategory(cat)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${noteCategory === cat ? 'bg-white text-black' : 'bg-white/5 text-white/30'}`}>{cat}</button>
                  ))}
               </div>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="flex-1 bg-transparent border-none outline-none resize-none p-8 text-xl leading-relaxed text-white/80 placeholder:text-white/5 font-semibold custom-scrollbar focus:text-cyan-100/90 transition-colors" placeholder="Redacta tus mociones, notas o resoluciones aquí..." />
          </div>
        </section>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .prose img { max-width: 100%; height: auto; }
        .prose p { margin-bottom: 1em; line-height: 1.6; }
        .prose h1, .prose h2, .prose h3 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: bold; }
      `}</style>
    </div>
  );
}
