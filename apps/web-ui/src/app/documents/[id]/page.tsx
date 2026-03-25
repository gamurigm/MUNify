'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import CollaborativeEditor from '@/components/CollaborativeEditor';
import AiAssistantPanel from '@/components/AiAssistantPanel';
import NotesPanel from '@/components/NotesPanel';
import TerminalAgentUI from '@/components/TerminalAgentUI';

interface DocumentData {
  id: number;
  title: string;
  topic: string;
  country: string;
  committee: string;
  content: string;
  status: string;
  authorUsername: string;
  updatedAt: string;
}

export default function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);

  // Panels State
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('munify_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch(`http://localhost:8080/api/documents/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Documento no encontrado');
        return res.json();
      })
      .then(data => {
        setDoc(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040d21] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#00f5ff]/20 border-t-[#00f5ff] rounded-full animate-spin" />
          <p className="text-sm font-medium text-white/50 animate-pulse uppercase tracking-widest">Recuperando Archivos Diplomáticos...</p>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-[#040d21] flex items-center justify-center text-white p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-white/50 mb-8">Documento no encontrado en los archivos centrales.</p>
          <Link href="/" className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition">
            Volver al Inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#040d21] text-white flex flex-col overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#00f5ff]/5 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-[#c44dff]/5 blur-[120px]" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 border-b border-white/10 bg-[#040d21]/80 backdrop-blur-xl h-16 shrink-0 flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-white/40 hover:text-white transition group flex items-center gap-2 text-sm">
            <span className="transform group-hover:-translate-x-1 transition">←</span>
            <span>Dashboard</span>
          </Link>
          <div className="h-6 w-px bg-white/10" />
          <button 
            onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isAiPanelOpen ? 'bg-[#00f5ff]/10 border-[#00f5ff]/30 text-[#00f5ff]' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
          >
            ⚡ AI Assistant
          </button>
          <button 
            onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all border ${isTerminalOpen ? 'bg-[#00e5ff]/20 border-[#00e5ff]/40 text-[#00e5ff]' : 'bg-black/40 border-[#00e5ff]/20 text-[#00e5ff]/60 hover:bg-[#00e5ff]/10 hover:text-[#00e5ff]'}`}
          >
            &gt;_ Terminal
          </button>
        </div>

        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold tracking-tight">{doc.title}</h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">{doc.committee} · {doc.country}</p>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsToolsPanelOpen(!isToolsPanelOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isToolsPanelOpen ? 'bg-white/10 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'}`}
          >
            🗒️ Notas & Refs
          </button>
          <div className="h-6 w-px bg-white/10" />
          <button 
            className="px-4 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-90 shadow-[0_0_10px_rgba(0,245,255,0.2)]" 
            style={{ background: 'linear-gradient(135deg, #00f5ff, #c44dff)', color: '#040d21' }}
            onClick={async () => {
              try {
                const token = localStorage.getItem('munify_token');
                const res = await fetch(`http://localhost:8080/api/documents/${id}/export-pdf`, {
                  headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
                });
                if (!res.ok) throw new Error('Export failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `MUNify_${doc.title.replace(/\s+/g, '_')}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                alert('Error al exportar PDF. ¿El backend está activo?');
                console.error(err);
              }
            }}
          >
            Exportar Oficial
          </button>
        </div>
      </header>

      {/* Main Workspace (3 columns + bottom terminal) */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden">
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: AI Assistant */}
        <AiAssistantPanel isOpen={isAiPanelOpen} />

        {/* Center Column: Editor Canvas */}
        <section className="flex-1 overflow-y-auto w-full relative">
          <div className="max-w-[800px] mx-auto py-10 px-4 min-h-full">
            {/* The Document Paper */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 shadow-2xl relative">
              {/* Subtle watermark */}
              <div className="absolute top-10 right-10 opacity-5 pointer-events-none">
                <img src="/images/logo.png" alt="Watermark" width={100} height={100} />
              </div>
              
              <div className="relative z-10">
                <div className="text-center mb-10 pb-10 border-b border-white/10">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#00f5ff] mb-3">Naciones Unidas</p>
                  <h2 className="text-2xl font-serif font-bold mb-2">{doc.committee.toUpperCase()}</h2>
                  <div className="flex items-center justify-center gap-3 text-xs text-white/50 italic">
                    <span>Delegación de {doc.country}</span>
                    <span>•</span>
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <CollaborativeEditor 
                  documentId={doc.id.toString()} 
                  initialContent={doc.content} 
                  username={doc.authorUsername || "Delegado"} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Notes & Tools */}
        <NotesPanel isOpen={isToolsPanelOpen} />

        </div>

        {/* Sandbox Terminal Bottom Panel */}
        {isTerminalOpen && (
          <div className="h-64 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-50 relative">
            <TerminalAgentUI documentContext={doc.content} />
          </div>
        )}
      </main>
    </div>
  );
}
