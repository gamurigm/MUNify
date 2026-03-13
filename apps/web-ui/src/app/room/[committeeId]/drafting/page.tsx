'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Dynamically import the editor to prevent SSR issues
const DynamicEditor = dynamic(() => import('./DraftingEditor'), { 
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center text-white/10 uppercase font-black text-[10px] tracking-widest animate-pulse">Cargando Editor...</div>
});

const COMMITTEES: Record<string, { name: string; sub: string; color: string; article: string }> = {
  GA: { name: 'Asamblea General', sub: 'General Assembly', color: '#00f5ff', article: 'La' },
  SC: { name: 'Consejo de Seguridad', sub: 'Security Council', color: '#c44dff', article: 'El' },
  EC: { name: 'Consejo Económico y Social', sub: 'ECOSOC', color: '#00f5ff', article: 'El' },
  DC: { name: 'Comité de Desarme', sub: 'DISEC', color: '#c44dff', article: 'El' },
  SH: { name: 'SOCHUM', sub: 'Social, Cultural y Humanitario', color: '#00f5ff', article: 'El' },
  CJ: { name: 'Corte Internacional', sub: 'CIJ / ICJ', color: '#c44dff', article: 'La' },
  AC: { name: 'ACNUR', sub: 'Alto Comisionado para los Refugiados', color: '#00f5ff', article: 'El' },
  UF: { name: 'UNICEF', sub: 'Fondo para la Infancia', color: '#c44dff', article: 'El' },
  G2: { name: 'G20', sub: 'Grupo de los Veinte', color: '#00f5ff', article: 'El' },
  US: { name: 'UNESCO', sub: 'Educación, Ciencia y Cultura', color: '#c44dff', article: 'La' },
  UD: { name: 'UNODC', sub: 'Droga y Delito', color: '#00f5ff', article: 'La' },
  OT: { name: 'OTAN', sub: 'Organización del Tratado del Atlántico Norte', color: '#c44dff', article: 'La' },
  UC: { name: 'UNCTAD', sub: 'Comercio y Desarrollo', color: '#00f5ff', article: 'La' },
  OM: { name: 'ONU Mujeres', sub: 'Igualdad de Género', color: '#c44dff', article: 'La' },
};

export default function DraftingPage() {
  const { committeeId } = useParams();
  const router = useRouter();
  const [chatInput, setChatInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'edit' | 'latex'>('edit');
  const [params, setParams] = useState({
    topic: '', 
    delegation: '', 
    docType: 'Proyecto de Resolución', 
    session: 'Sesión Ordinaria 2026' 
  });

  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string; action?: string; cited_articles?: { treaty: string; article_id: string; text: string }[] }[]>([
    { role: 'ai', text: 'Estudio de Redacción listo. Define los parámetros para comenzar.' }
  ]);

  const [editorContent, setEditorContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const isResizing = useRef(false);
  const [digitalSealId, setDigitalSealId] = useState<string>('MUNIFY-INIT');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const lastSavedVersion = useRef<string>('');
  
  const [zoom, setZoom] = useState(1);
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    setDigitalSealId(Math.random().toString(36).substring(7).toUpperCase());
  }, []);

  const dbRef = useRef<IDBDatabase | null>(null);

  // Persistence Init
  useEffect(() => {
    const request = indexedDB.open('MUNifyDB', 5);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e: any) => {
      dbRef.current = e.target.result;
      console.log('✅ Base de datos MUNify conectada');
    };
  }, []);

  // Data Loading
  useEffect(() => {
    const localData = localStorage.getItem(`draft_${committeeId}`);
    if (localData && localData !== '<p></p>') {
      setEditorContent(localData);
      lastSavedVersion.current = localData;
      setSaveStatus('saved');
    }

    const loadFromDB = () => {
      if (!dbRef.current) {
         setTimeout(loadFromDB, 200);
         return;
      }
      try {
        const transaction = dbRef.current.transaction('drafts', 'readonly');
        const store = transaction.objectStore('drafts');
        const request = store.get(committeeId as string);
        request.onsuccess = () => {
          if (request.result && (!localData || localData === '<p></p>')) {
             setEditorContent(request.result.html);
             lastSavedVersion.current = request.result.html;
             setSaveStatus('saved');
          }
          setIsInitialLoad(false);
        };
        request.onerror = () => setIsInitialLoad(false);
      } catch (e) {
        setIsInitialLoad(false);
      }
    };
    loadFromDB();
  }, [committeeId]);

  // Auto-save
  useEffect(() => {
    if (isInitialLoad) return;
    
    const timer = setTimeout(() => {
      if (editorContent === lastSavedVersion.current) return;
      if (editorContent === '<p></p>' || !editorContent) return;

      setSaveStatus('saving');
      
      const payload = { id: committeeId, html: editorContent, updatedAt: new Date() };
      
      localStorage.setItem(`draft_${committeeId}`, editorContent);

      if (dbRef.current) {
        try {
          const transaction = dbRef.current.transaction('drafts', 'readwrite');
          const store = transaction.objectStore('drafts');
          store.put(payload);
          lastSavedVersion.current = editorContent;
          setSaveStatus('saved');
        } catch (e) {
          console.error("IDB Save Error", e);
          setSaveStatus('idle');
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [editorContent, committeeId, isInitialLoad]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth > 300 && newWidth < window.innerWidth / 2) {
      setSidebarWidth(newWidth);
    }
  }, []);

  const handleStartDrafting = () => {
    setIsModalOpen(false);
    if (!editorContent || editorContent === '<p></p>') {
        let skeleton = '';
        if (params.docType === 'Proyecto de Resolución' || params.docType === 'Resolución') {
            skeleton = `<div class="resolution-structure">
                    <p><i>Guiados por</i> los principios de la Carta de las Naciones Unidas,</p>
                    <p><i>Reafirmando</i> que la paz y la seguridad son fundamentales,</p>
                    <p>1. <b>Insta</b> a todos los Estados Miembros a...</p>
                    <p>2. <b>Designa</b> una comisión especial para el seguimiento de...</p>
                </div>`;
        }
        setEditorContent(skeleton);
    }

    setMessages(prev => [
      ...prev, 
      { role: 'user', text: `Proyecto: ${params.topic}` }, 
      { role: 'ai', text: `Estudio configurado para **${params.docType}**. He cargado la plantilla estructural de **LATEX** en el lienzo.`, action: 'generate-header' }
    ]);
  };

  const handleAISuggestion = (suggestion: string) => {
     window.dispatchEvent(new CustomEvent('insert-ai-content', { detail: suggestion }));
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput.trim();
    setChatInput('');
    const newMessage = { role: 'user' as 'user' | 'ai', text: userMsg };
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    setIsChatLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.slice(-10).map(m => ({ role: String(m.role), text: String(m.text) })),
          topic: params.topic || "Debate General",
          country: params.delegation || "Delegado",
          committee: committeeId
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: data.response,
        cited_articles: data.cited_articles || []
      }]);

    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: "Lo siento, He experimentado una interferencia en la señal diplomática. ¿Podrías repetir tu consulta?" 
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
        const canvas = await html2canvas(printRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
                const allStyles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
                allStyles.forEach(s => {
                    try {
                        if (s instanceof HTMLStyleElement) {
                            if (s.innerHTML.includes('lab(') || s.innerHTML.includes('oklch(')) {
                                s.innerHTML = s.innerHTML.replace(/(lab|oklch)\([^)]*\)/g, '#000000');
                            }
                        }
                    } catch (e) {}
                });
                clonedDoc.body.style.backgroundColor = 'white';
                clonedDoc.body.style.color = 'black';
            }
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        
        const fileName = `${params.docType}_${params.delegation || 'MUN'}.pdf`;
        pdf.save(fileName);

        setMessages(prev => [...prev, { 
            role: 'ai', 
            text: `✅ **¡Hecho!** El PDF profesional se ha generado con todos los encabezados oficiales.` 
        }]);
    } catch (error) {
        console.error('Export error:', error);
        setMessages(prev => [...prev, { role: 'ai', text: '❌ Error al compilar. Revisa la consola para más detalles.' }]);
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="h-screen bg-[#020617] text-white flex flex-col font-sans overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-10 bg-cyan-500" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-10 bg-purple-500" />
      </div>

      <header className="relative z-50 h-14 border-b border-white/5 bg-[#020617]/80 backdrop-blur-3xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={() => router.back()} className="w-8 h-8 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition group">
            <span className="opacity-40 group-hover:opacity-100 transition">←</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-base font-black tracking-tight uppercase flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Drafting Studio
              {saveStatus !== 'idle' && (
                <span className={`ml-2 text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${saveStatus === 'saving' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse' : 'bg-green-500/10 border-green-500/20 text-green-500 animate-in fade-in'}`}>
                    {saveStatus === 'saving' ? 'Saving...' : 'Sync Safe'}
                </span>
              )}
            </h1>
            <span className="text-[9px] font-bold text-white/20 tracking-widest uppercase flex items-center gap-2">
                AI Co-Pilot Workspace
            </span>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setViewMode(viewMode === 'edit' ? 'latex' : 'edit')}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition border ${viewMode === 'latex' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'}`}
            >
              {viewMode === 'edit' ? 'Ver LaTeX' : 'Volver a Edición'}
            </button>
            <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase hover:bg-white/10 transition">Parámetros</button>
            <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition shadow-lg ${isExporting ? 'bg-white/10 text-white/20' : 'bg-cyan-500 text-[#020617] hover:bg-cyan-400 shadow-cyan-500/20'}`}
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-white/20 animate-ping" />
                    Compilando...
                </span>
              ) : 'Finalizar'}
            </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex overflow-hidden p-2 gap-2">
        <section className="flex-1 rounded-[32px] border border-white/10 bg-[#021021]/40 backdrop-blur-3xl flex flex-col overflow-hidden relative shadow-2xl">
            <div className="absolute top-4 right-8 z-50 flex items-center gap-3 bg-black/60 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                <button onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs font-black transition">-</button>
                <span className="text-[10px] font-black w-12 text-center uppercase tracking-widest text-white/60">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(Math.min(1.8, zoom + 0.1))} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-xs font-black transition">+</button>
                <button onClick={() => setZoom(1)} className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-[8px] font-black uppercase hover:bg-cyan-500/20 transition">Reset</button>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar p-12">
                <div style={{ 
                    transform: `scale(${zoom})`, 
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease-out',
                    width: 'fit-content',
                    margin: '0 auto'
                }}>
                    <DynamicEditor 
                        viewMode={viewMode} 
                        content={editorContent} 
                        params={params}
                        onContentChange={setEditorContent} 
                    />
                </div>
            </div>
        </section>

        <aside 
            className="flex flex-col gap-2 shrink-0 h-full relative"
            style={{ width: `${sidebarWidth}px` }}
        >
            <div 
                onMouseDown={startResizing}
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/30 transition-colors z-50 group"
            >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-white/10 group-hover:bg-cyan-500/50 rounded-full" />
            </div>

            <div className="flex-1 rounded-[32px] border border-white/10 bg-[#021021]/80 backdrop-blur-3xl flex flex-col overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-cyan-400">IA Co-Pilot</h2>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-slate-950/20">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`p-6 rounded-[28px] shadow-xl ${
                                m.role === 'user' 
                                ? 'bg-white/10 text-white border border-white/5 text-[15px]' 
                                : 'bg-gradient-to-br from-cyan-500/10 to-blue-500/5 text-cyan-50/90 border border-cyan-500/20 backdrop-blur-md text-[16px] font-serif'
                            }`}>
                                {m.text}
                            </div>
                            {m.action === 'generate-header' && (
                                <button 
                                    onClick={() => handleAISuggestion(`<p><i>Guiados por</i> los principios de la Carta de las Naciones Unidas,</p>`)}
                                    className="px-4 py-2 rounded-xl bg-cyan-500 text-black text-[9px] font-black uppercase shadow-lg shadow-cyan-500/20"
                                >
                                    + Insertar Cláusula Guía
                                </button>
                            )}
                            {/* CITED ARTICLES WITH INSERT BUTTONS */}
                            {m.cited_articles && m.cited_articles.length > 0 && (
                                <div className="w-full space-y-2 mt-1">
                                    <div className="text-[8px] font-black uppercase tracking-widest text-cyan-400/60 ml-2">
                                        📜 Artículos Encontrados — Click para insertar
                                    </div>
                                    {m.cited_articles.map((art, j) => (
                                        <div key={j} className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-4 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all cursor-pointer"
                                             onClick={() => handleAISuggestion(
                                                `<p><i>Recordando</i> el <b>Artículo ${art.article_id}</b> de la <b>${art.treaty}</b>, que establece: "${art.text.substring(0, 200)}${art.text.length > 200 ? '...' : ''}"</p>`
                                             )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[9px] font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg uppercase">
                                                            Art. {art.article_id}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-white/30 truncate">
                                                            {art.treaty}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">
                                                        {art.text.substring(0, 150)}{art.text.length > 150 ? '...' : ''}
                                                    </p>
                                                </div>
                                                <button className="shrink-0 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-400 text-[8px] font-black uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all hover:bg-cyan-500 hover:text-black shadow-lg">
                                                    + Insertar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex flex-col items-start gap-2">
                            <div className="p-6 rounded-[28px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 backdrop-blur-md animate-pulse">
                                <span className="flex items-center gap-2 text-[14px] font-serif italic">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                                    Consultando protocolos...
                                </span>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-5 border-t border-white/10 bg-white/[0.02]">
                    <div className="relative group">
                        <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Ej: 'Genera tres cláusulas operativas...'"
                            className="w-full bg-black/60 border border-white/10 rounded-[28px] p-5 pr-14 text-[12px] font-bold outline-none focus:border-cyan-500/50 focus:bg-black/80 transition-all h-28 resize-none shadow-inner"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={isChatLoading}
                            className={`absolute right-4 bottom-4 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${isChatLoading ? 'bg-white/10 text-white/20' : 'bg-cyan-500 text-[#020617] hover:scale-110 active:scale-95'}`}
                        >
                            <span className="text-xl">➤</span>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-lg bg-[#020617] border border-white/10 rounded-[40px] p-10 text-center shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                <div className="mb-8">
                    <h2 className="text-xl font-black uppercase tracking-widest text-cyan-400 font-serif">Structure Protocol</h2>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Initialization Settings for AI</p>
                </div>
                <div className="space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black uppercase opacity-40 ml-3">Tópico</label>
                            <input 
                                value={params.topic} 
                                onChange={e => setParams({...params, topic: e.target.value})} 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl h-11 px-5 text-sm font-bold outline-none"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black uppercase opacity-40 ml-3">Delegación</label>
                            <input 
                                value={params.delegation} 
                                onChange={e => setParams({...params, delegation: e.target.value})} 
                                placeholder="Ej: Federación de Rusia"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl h-11 px-5 text-sm font-bold outline-none"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black uppercase opacity-40 ml-3">Tipo de Documento</label>
                            <select 
                                value={params.docType} 
                                onChange={e => setParams({...params, docType: e.target.value})} 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl h-11 px-5 text-sm font-bold outline-none appearance-none"
                            >
                                <option className="bg-[#020617]">Proyecto de Resolución</option>
                                <option className="bg-[#020617]">Declaración</option>
                                <option className="bg-[#020617]">Position Paper</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[9px] font-black uppercase opacity-40 ml-3">Sesión / Fecha</label>
                            <input 
                                value={params.session} 
                                onChange={e => setParams({...params, session: e.target.value})} 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl h-11 px-5 text-sm font-bold outline-none"
                            />
                        </div>
                    </div>
                </div>
                <button 
                  onClick={handleStartDrafting} 
                  className="w-full h-14 rounded-2xl bg-cyan-500 text-black text-[11px] font-black uppercase mt-8 hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                >
                  Inicializar Plantilla LaTeX
                </button>
            </div>
        </div>
      )}

      {/* HIDDEN PRINT VIEW */}
      <div style={{ position: 'fixed', top: '10000px', left: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div 
          ref={printRef}
          style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            backgroundColor: 'white', 
            color: 'black', 
            padding: '25mm', 
            fontFamily: 'serif', 
            display: 'flex', 
            flexDirection: 'column',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ border: '1px solid black', padding: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src="/images/ONU-black.jpg" style={{ width: '80px' }} alt="UN Logo" />
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13.5pt', fontFamily: 'sans-serif', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1 }}>
                      <span style={{ fontWeight: 900 }}>Naciones Unidas</span>
                  </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '10pt', fontFamily: 'sans-serif', fontWeight: 700, color: '#000', textTransform: 'uppercase' }}>
                  <div style={{ fontWeight: 900 }}>Distr. General</div>
                  <div>{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '18pt', fontWeight: 900, fontFamily: 'serif', margin: 0 }}>
                  {(committeeId && COMMITTEES[committeeId as string]?.name) || committeeId}
              </div>
          </div>

          <div style={{ borderTop: '3px solid black', marginBottom: '25px' }}></div>

          <div style={{ marginBottom: '30px', fontFamily: 'serif' }}>
              {params.docType === 'Proyecto de Resolución' || params.docType === 'Resolución' ? (
                  <>
                      <div style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 900, marginBottom: '15px' }}>
                          Resolución 2026/1 (2026)
                      </div>
                      <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.4 }}>
                          Aprobada por {((committeeId && COMMITTEES[committeeId as string]?.article) || 'El').toLowerCase() === 'el' ? 'el' : 'la'} {(committeeId && COMMITTEES[committeeId as string]?.name) || 'Asamblea General'} en su {params.session} sesión, celebrada el {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '11pt', fontStyle: 'italic', marginTop: '20px' }}>
                          {(committeeId && COMMITTEES[committeeId as string]?.article) || 'El'} {(committeeId && COMMITTEES[committeeId as string]?.name) || 'Asamblea General'},
                      </div>
                  </>
              ) : (
                  <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.4 }}>
                      <div>{params.session}</div>
                      <div>Tema {params.topic || 'X'} del programa</div>
                      <div style={{ marginTop: '5px' }}>Serie de sesiones de alto nivel sobre el tema</div>
                      <div style={{ textTransform: 'uppercase', marginTop: '10px', textAlign: 'center', fontSize: '13pt' }}>
                          {params.topic || 'DECLARACIÓN MINISTERIAL'}
                      </div>
                  </div>
              )}
              <div style={{ borderTop: '0.5px solid black', marginTop: '20px' }}></div>
          </div>

          <div 
            style={{ 
                flex: 1, 
                fontSize: '12pt', 
                lineHeight: '1.6', 
                textAlign: 'justify',
                color: '#000',
                fontFamily: 'serif'
            }}
            dangerouslySetInnerHTML={{ __html: editorContent }}
          />

          <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '0.5px solid black', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.6 }}>
             <div style={{ fontSize: '8pt', fontFamily: 'sans-serif', fontWeight: 700, fontStyle: 'italic', textTransform: 'uppercase' }}>Sistema Integrado de Gestión — MUNify AI</div>
             <div style={{ fontSize: '7pt', fontFamily: 'sans-serif', textAlign: 'right', fontWeight: 900 }}>Seal ID: {digitalSealId}</div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .prose-paper-editor p { font-size: 11.5pt; line-height: 1.6; text-align: justify; margin-bottom: 12px; font-family: serif; color: black; }
      `}</style>
    </div>
  );
}
