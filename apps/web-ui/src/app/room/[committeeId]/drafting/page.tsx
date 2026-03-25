'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TerminalAgentUI from '@/components/TerminalAgentUI';

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
  const [terminalSizeMode, setTerminalSizeMode] = useState<'off' | 'compact' | 'mid' | 'full'>('off');
  const [viewMode, setViewMode] = useState<'edit' | 'latex'>('edit');
  const [params, setParams] = useState({
    topic: '', 
    delegation: '', 
    docType: 'Proyecto de Resolución', 
    session: 'Sesión Ordinaria 2026',
    deepResearch: false
  });

  const [messages, setMessages] = useState<{ 
    role: 'user' | 'ai'; 
    text: string; 
    action?: string; 
    cited_articles?: { treaty: string; article_id: string; text: string }[];
    notebook_citations?: { source_title: string; text_segment: string; page_number?: number }[];
  }[]>([]);

  const [editorContent, setEditorContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(420);
  const isResizing = useRef(false);
  const [digitalSealId, setDigitalSealId] = useState<string>('MUNIFY-INIT');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const lastSavedVersion = useRef<string>('');
  
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // NotebookLM states
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [isNotebookLoading, setIsNotebookLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);
  const [notebookSources, setNotebookSources] = useState<{ id: string; title: string; type: string }[]>([]);
  const [availableNotebooks, setAvailableNotebooks] = useState<{ id: string; title: string }[]>([]);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(false);
  const [nlmAuthenticated, setNlmAuthenticated] = useState<boolean | null>(null);
  const [nlmReady, setNlmReady] = useState<boolean>(false);
  const [isResettingAuth, setIsResettingAuth] = useState(false);
  const [isTriggeringLogin, setIsTriggeringLogin] = useState(false);
  const [isWaitingForLoginConfirm, setIsWaitingForLoginConfirm] = useState(false);
  const [isConfirmingLogin, setIsConfirmingLogin] = useState(false);
  const [customNotebookTitle, setCustomNotebookTitle] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setDigitalSealId(Math.random().toString(36).substring(7).toUpperCase());
    // Check NLM auth status on mount
    fetch('http://localhost:8000/api/v1/notebook-status')
      .then(r => r.json())
      .then(d => {
        setNlmAuthenticated(d.authenticated);
        setNlmReady(d.ready);
      })
      .catch(() => {
        setNlmAuthenticated(false);
        setNlmReady(false);
      });
  }, []);

  const dbRef = useRef<IDBDatabase | null>(null);

  // Persistence Init


  const handleResetNotebookAuth = async () => {
    if (isResettingAuth) return;
    setIsResettingAuth(true);
    setMessages(prev => [...prev, { role: 'ai', text: '🧹 *Limpiando rastro de sesión anterior...*' }]);
    try {
        await fetch('http://localhost:8000/api/v1/notebook-reset-auth', { method: 'POST' });
        setNlmAuthenticated(false);
        setNlmReady(false);
        setNotebookId(null);
        setMessages(prev => [...prev, { role: 'ai', text: '✅ **Sesión limpia.** Ahora puedes iniciar un nuevo login de forma segura.' }]);
    } catch (err) {
        setMessages(prev => [...prev, { role: 'ai', text: '❌ Error al limpiar la sesión. Reintenta en unos instantes.' }]);
    } finally {
        setIsResettingAuth(false);
    }
  };

  const [isReconnecting, setIsReconnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const r = await fetch('http://localhost:8000/api/v1/notebook-status');
      const d = await r.json();
      setNlmAuthenticated(d.authenticated);
      setNlmReady(d.ready);
    } catch (err) {
      setNlmAuthenticated(false);
      setNlmReady(false);
    }
  }, []);

  const handleConfirmLogin = async () => {
    if (isConfirmingLogin) return;
    setIsConfirmingLogin(true);
    setMessages(prev => [...prev, { role: 'ai', text: '🗝️ **Finalizando autenticación...** Pidiendo al sistema que guarde tus llaves.' }]);
    try {
      const r = await fetch('http://localhost:8000/api/v1/notebook-login-confirm', { method: 'POST' });
      const d = await r.json();
      
      if (d.status === 'success') {
        setNlmAuthenticated(true);
        setNlmReady(d.ready);
        setIsWaitingForLoginConfirm(false);
        setMessages(prev => [...prev, { role: 'ai', text: '✅ **¡Acceso Concedido!** Ya puedes cerrar la pestaña de Google en tu navegador.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: `⚠️ **Error en confirmación:** ${d.message || 'Intenta de nuevo.'}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: '❌ **Error crítico al confirmar el login.**' }]);
    } finally {
      setIsConfirmingLogin(false);
    }
  };

  const handleReconnect = async () => {
    if (isReconnecting) return;
    setIsReconnecting(true);
    setMessages(prev => [...prev, { role: 'ai', text: '⚡ **Forzando re-conexión con NotebookLM...**' }]);
    try {
      const r = await fetch('http://localhost:8000/api/v1/notebook-reconnect', { method: 'POST' });
      const d = await r.json();
      
      if (d.ready) {
        setNlmAuthenticated(true);
        setNlmReady(true);
        setMessages(prev => [...prev, { role: 'ai', text: '✅ **Re-conexión exitosa.** Los servicios están operativos.' }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: '⚠️ **La reconexión falló.** Si acabas de hacer login, usa el botón de "Confirmar Login".' }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: '❌ **Error de comunicación con el servidor.**' }]);
    } finally {
      setIsReconnecting(false);
    }
  };

  useEffect(() => {
    if (nlmAuthenticated === false || !nlmReady) {
      const interval = setInterval(checkStatus, 5000); // Check every 5s if not fully ready
      return () => clearInterval(interval);
    }
  }, [nlmAuthenticated, nlmReady, checkStatus]);

  // 🔥 Efecto de Re-sincronización automática
  useEffect(() => {
    if (nlmReady) {
      fetchAvailableNotebooks();
      // Notificamos al usuario solo si no hay ya un mensaje de éxito reciente
      setMessages(prev => {
        if (prev.some(m => m.text.includes('Conexión Establecida'))) return prev;
        return [...prev, { role: 'ai', text: '📡 **Conexión Establecida.** He sincronizado tu biblioteca de NotebookLM y el Co-Pilot está operativo.' }];
      });
    }
  }, [nlmReady]);

  const handleTriggerNotebookLogin = async () => {
    if (isTriggeringLogin) return;
    setIsTriggeringLogin(true);
    setMessages(prev => [...prev, { role: 'ai', text: '🚀 **Iniciando protocolo de Login.** Se abrirá una ventana en tu navegador por defecto.' }]);
    try {
        const res = await fetch('http://localhost:8000/api/v1/notebook-login', { method: 'POST' });
        if (!res.ok) throw new Error('Failed to trigger');
        setIsWaitingForLoginConfirm(true); // Activamos el paso 2
    } catch (err) {
        setMessages(prev => [...prev, { role: 'ai', text: '❌ **Fallo al disparar el Login.** Asegúrate de que el backend está corriendo correctamente.' }]);
    } finally {
        setIsTriggeringLogin(false);
    }
  };
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

    // No añadimos mensajes iniciales para que el chat inicie vacío
  };

  const handleAISuggestion = (suggestion: string) => {
     window.dispatchEvent(new CustomEvent('insert-ai-content', { detail: suggestion }));
  };

  useEffect(() => {
    const handleDraftUpdate = (e: any) => {
      setEditorContent(e.detail);
    };
    window.addEventListener('update-draft-content', handleDraftUpdate);
    return () => window.removeEventListener('update-draft-content', handleDraftUpdate);
  }, []);

  const fetchNotebookSources = async (nbId: string) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/api/v1/notebooks/${nbId}/sources`);
      if (res.ok) {
        const data = await res.json();
        setNotebookSources(data.sources || []);
      }
    } catch (e) {
      console.error('Error fetching sources:', e);
    }
  };

  const fetchAvailableNotebooks = async () => {
    setIsLoadingNotebooks(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/api/v1/notebooks`);
      if (res.ok) {
        const data = await res.json();
        setAvailableNotebooks(data.notebooks || []);
      }
    } catch (e) {
      console.error('Error fetching notebooks:', e);
    } finally {
      setIsLoadingNotebooks(false);
    }
  };

  const handleSelectNotebook = async (nbId: string) => {
    setNotebookId(nbId);
    await fetchNotebookSources(nbId);
    setIsContextPanelOpen(false);
    
    const nb = availableNotebooks.find(n => n.id === nbId);
    
    // 🔥 Limpieza TOTAL de mensajes para asegurar nuevo contexto
    setMessages([
      { 
        role: 'ai', 
        text: `🔄 **Contexto actualizado.** Me he vinculado al cuaderno **"${nb?.title || 'Existente'}"**. Ahora mi base de conocimientos se limita exclusivamente a estas nuevas fuentes bibliográficas.` 
      }
    ]);
  };

  const handleNotebookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const title = customNotebookTitle.trim() || `Investigación: ${params.topic || 'Sin Título'}`;

    setIsNotebookLoading(true);
    const formData = new FormData();
    formData.append('notebookTitle', title);
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }

    try {
        const response = await fetch('http://localhost:8000/api/v1/ingest-context', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error('Ingest Error');
        const data = await response.json();
        setNotebookId(data.notebook_id);
        setNotebookSources(data.sources || []);
        
        const fileNames = Array.from(files).map(f => f.name).join(', ');
        setMessages(prev => [...prev, { 
            role: 'ai', 
            text: `✅ **Cuaderno "${title}" Creado.** He integrado ${files.length} fuentes bibliográficas para tu investigación.` 
        }]);
    } catch (error) {
        console.error('Upload Error:', error);
        setMessages(prev => [...prev, { role: 'ai', text: "❌ Error al crear el cuaderno bibliográfico." }]);
    } finally {
        setIsNotebookLoading(false);
        if (e.target) e.target.value = '';
    }
  };

  const handleAppendFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !notebookId) return;

    setIsNotebookLoading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch(`http://localhost:8000/api/v1/notebooks/${notebookId}/append`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Append Error');
      const data = await response.json();
      setNotebookSources(data.sources || []);

      const fileNames = Array.from(files).map(f => f.name).join(', ');
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `📎 **Fuentes añadidas.** Se agregaron ${data.uploaded_count} archivo(s) (${fileNames}) al cuaderno activo.`
      }]);
    } catch (error) {
      console.error('Append Error:', error);
      setMessages(prev => [...prev, { role: 'ai', text: '❌ Error al añadir fuentes al cuaderno.' }]);
    } finally {
      setIsNotebookLoading(false);
      if (e.target) e.target.value = '';
    }
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
          committee: committeeId,
          notebookId: notebookId,
          deepResearch: params.deepResearch
        })
      });

      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'ai', 
        text: data.response,
        cited_articles: data.cited_articles || [],
        notebook_citations: data.notebook_citations || []
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
                onClick={() => {
                  if (terminalSizeMode === 'off') setTerminalSizeMode('compact');
                  else if (terminalSizeMode === 'compact') setTerminalSizeMode('mid');
                  else if (terminalSizeMode === 'mid') setTerminalSizeMode('full');
                  else setTerminalSizeMode('off');
                }}
                className={`px-4 py-2 rounded-xl text-[11px] font-black font-mono uppercase tracking-widest transition shadow-lg ${terminalSizeMode !== 'off' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'}`}
            >
              &gt;_ {terminalSizeMode === 'off' ? 'Terminal' : terminalSizeMode.toUpperCase()}
            </button>
            <button 
                onClick={() => setViewMode(viewMode === 'edit' ? 'latex' : 'edit')}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition border ${viewMode === 'latex' ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10'}`}
            >
              {viewMode === 'edit' ? 'Ver LaTeX' : 'Volver a Edición'}
            </button>
            <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[11px] font-black uppercase hover:bg-white/10 transition">Parámetros</button>
            <button 
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition shadow-lg ${isExporting ? 'bg-white/10 text-white/20' : 'bg-cyan-500 text-[#020617] hover:bg-cyan-400 shadow-cyan-500/20'}`}
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

      <main className="relative z-10 flex-1 flex flex-col overflow-hidden p-2 gap-2">
        <div className="flex-1 flex overflow-hidden gap-2">
          <section className="flex-1 rounded-[32px] border border-white/10 bg-[#021021]/40 backdrop-blur-3xl flex flex-col overflow-hidden relative shadow-2xl">
            
            <div className="flex-1 overflow-auto custom-scrollbar p-12">
                <div className="flex-1 h-full min-h-0">
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
                <div className="border-b border-white/5 bg-white/[0.01]">
                    <div className="p-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-cyan-400">IA Co-Pilot</h2>
                            <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-0.5">Dual-Engine (RAG + NotebookLM)</p>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleNotebookUpload} 
                                multiple 
                                accept=".pdf" 
                                className="hidden" 
                            />
                            <input 
                                type="file" 
                                ref={appendFileInputRef} 
                                onChange={handleAppendFiles} 
                                multiple 
                                accept=".pdf" 
                                className="hidden" 
                            />
                            {notebookId && (
                                <button 
                                    onClick={() => appendFileInputRef.current?.click()}
                                    disabled={isNotebookLoading}
                                    className="px-2 py-1.5 rounded-lg border bg-white/5 text-white/40 border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
                                    title="Añadir más fuentes al cuaderno"
                                >
                                    + Añadir
                                </button>
                            )}
                            <button 
                                onClick={() => setIsContextPanelOpen(!isContextPanelOpen)}
                                disabled={isNotebookLoading}
                                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${
                                    notebookId 
                                    ? 'bg-cyan-500 text-black border-cyan-500' 
                                    : nlmAuthenticated === false
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20 cursor-not-allowed'
                                    : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                    {isNotebookLoading ? (
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                                            Analizando...
                                        </span>
                                    ) : (nlmAuthenticated === false || (nlmAuthenticated === true && !nlmReady)) ? (
                                        '⚠ Sin Auth'
                                    ) : notebookId ? (
                                        `✓ Cuaderno (${notebookSources.length})`
                                    ) : (
                                        '+ Vincular Fuentes'
                                    )}
                            </button>
                        </div>
                    </div>
                </div>

                    {/* Context Sources Panel */}
                    {isContextPanelOpen && (
                        <div className="border-t border-white/5 bg-black/40 backdrop-blur-3xl animate-in slide-in-from-top-4 duration-300">
                            <div className="p-8 space-y-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
                                {(nlmAuthenticated === false || !nlmReady) && (
                                    <div className="p-5 bg-white/[0.02] border border-white/10 rounded-[28px] space-y-3 backdrop-blur-md shadow-xl border-t-red-500/20">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-red-500/5 flex items-center justify-center text-lg border border-red-500/10">🔑</div>
                                            <div>
                                                <h3 className="text-[12px] font-black text-red-400/80 uppercase tracking-tight">Estado de Conexión</h3>
                                                <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest leading-none">Se requiere autenticación externa</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                onClick={handleResetNotebookAuth}
                                                disabled={isResettingAuth}
                                                className={`w-full h-10 rounded-xl border text-[8px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
                                                    isResettingAuth 
                                                    ? 'bg-white/5 border-white/10 text-white/10 animate-pulse' 
                                                    : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white active:scale-95'
                                                }`}
                                            >
                                                {isResettingAuth ? '...' : '1. Limpiar'}
                                            </button>
                                            <button 
                                                onClick={handleTriggerNotebookLogin}
                                                disabled={isTriggeringLogin}
                                                className={`w-full h-10 rounded-xl text-white text-[8px] font-black uppercase transition-all flex items-center justify-center gap-2 ${
                                                    isTriggeringLogin
                                                    ? 'bg-red-900/40 text-white/20 animate-pulse'
                                                    : 'bg-red-500/80 hover:bg-red-500 active:scale-95 shadow-lg shadow-red-500/10'
                                                }`}
                                            >
                                                {isTriggeringLogin ? '...' : '2. Abrir Login'}
                                            </button>
                                        </div>
                                        {isWaitingForLoginConfirm ? (
                                            <button 
                                                onClick={handleConfirmLogin}
                                                disabled={isConfirmingLogin}
                                                className={`w-full h-12 rounded-xl border text-[9px] font-black uppercase mt-2 transition-all flex items-center justify-center gap-2 animate-bounce ${
                                                    isConfirmingLogin 
                                                    ? 'bg-green-500/10 border-green-500/20 text-green-400 opacity-50' 
                                                    : 'bg-green-500/80 text-black border-green-500/50 hover:bg-green-500 active:scale-95 shadow-xl shadow-green-500/10'
                                                }`}
                                            >
                                                {isConfirmingLogin ? 'Confirmando...' : '✅ Hecho (Confirmar)'}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={handleReconnect}
                                                disabled={isReconnecting}
                                                className={`w-full h-12 rounded-xl border text-[9px] font-black uppercase mt-2 transition-all flex items-center justify-center gap-2 ${
                                                    isReconnecting 
                                                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 opacity-50' 
                                                    : 'bg-cyan-500/80 text-black border-cyan-500/50 hover:bg-cyan-500 active:scale-95 shadow-lg shadow-cyan-500/10'
                                                }`}
                                            >
                                                {isReconnecting ? '...' : '⚡ Reconectar'}
                                            </button>
                                        )}
                                        <p className="text-[7px] text-center text-white/10 uppercase font-black tracking-[0.3em]">Protocolo de Puente NotebookLM</p>
                                    </div>
                                )}

                                {/* Gestión de Cuadernos: SOLO si estamos Ready */}
                                {nlmAuthenticated && nlmReady && (
                                    <>

                                {notebookId ? (
                                    /* Active notebook: show sources */
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 opacity-60">Cuaderno Bibliográfico Activo</span>
                                                <h3 className="text-xs font-black text-white/90 truncate max-w-[200px] uppercase tracking-tight">
                                                    {availableNotebooks.find(n => n.id === notebookId)?.title || "Cuaderno Actual"}
                                                </h3>
                                            </div>
                                            <button
                                                onClick={() => { 
                                                    setNotebookId(null); 
                                                    setNotebookSources([]); 
                                                    setIsContextPanelOpen(false); 
                                                    setMessages([{ role: 'ai', text: 'Estudio de Redacción listo. Define los parámetros para comenzar.' }]); 
                                                }}
                                                className="px-3 py-1 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-[8px] font-black uppercase hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/10"
                                            >
                                                Cerrar Contexto
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Bibliografía ({notebookSources.length})</span>
                                                <button 
                                                    onClick={() => appendFileInputRef.current?.click()}
                                                    className="text-[8px] font-black text-cyan-400 hover:underline"
                                                >
                                                    + Añadir PDF
                                                </button>
                                            </div>
                                            {notebookSources.length === 0 ? (
                                                <p className="text-[10px] text-white/30 italic py-2">Procesando fuentes en NotebookLM...</p>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-2.5">
                                                    {notebookSources.map((src, i) => (
                                                        <div 
                                                            key={src.id || i} 
                                                            onClick={() => handleAISuggestion(`<p><i>Basado en el documento "${src.title}"...</i></p>`)}
                                                            className="group flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all cursor-pointer"
                                                        >
                                                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg shadow-cyan-500/5">
                                                                <span className="text-sm">📄</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-[11px] font-black text-white/70 block truncate leading-tight group-hover:text-white transition-colors">{src.title}</span>
                                                                <span className="text-[8px] font-black uppercase text-cyan-500/20 tracking-[0.2em] group-hover:text-cyan-500/60">{src.type}</span>
                                                            </div>
                                                            <div className="opacity-0 group-hover:opacity-100 text-cyan-500 font-black text-[10px] pr-2">
                                                                +
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* No notebook: PRO Create Flow */
                                    <div className="space-y-8">
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-1">Configuración del Repositorio</label>
                                                <input 
                                                    type="text"
                                                    value={customNotebookTitle}
                                                    onChange={(e) => setCustomNotebookTitle(e.target.value)}
                                                    placeholder="Ej: Bibliografía Derechos Humanos"
                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-5 py-4 text-[13px] font-bold text-white placeholder:text-white/10 focus:border-cyan-500/50 focus:bg-cyan-500/5 outline-none transition-all shadow-inner"
                                                />
                                            </div>
                                            
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isNotebookLoading}
                                                className="w-full group relative overflow-hidden p-10 rounded-[32px] border border-cyan-500/20 hover:border-cyan-500/50 bg-gradient-to-b from-cyan-500/[0.07] to-transparent transition-all shadow-2xl shadow-cyan-500/5"
                                            >
                                                <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="relative z-10 flex flex-col items-center gap-4">
                                                    <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg shadow-cyan-500/20">
                                                        <span className="text-3xl group-hover:scale-125 transition-transform">📥</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[13px] font-black uppercase tracking-[0.3em] text-cyan-400 group-hover:text-cyan-300 transition-colors block">Subir Fuentes Bibliográficas</span>
                                                        <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">PDF, DOCX (Máx 50 archivos)</p>
                                                    </div>
                                                </div>
                                            </button>
                                        </div>

                                        {availableNotebooks.length > 0 && (
                                            <div className="space-y-4 pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-4 px-1">
                                                    <div className="h-px flex-1 bg-white/5" />
                                                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/10">Historial de Biblioteca</span>
                                                    <div className="h-px flex-1 bg-white/5" />
                                                </div>
                                                <div className="max-h-64 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 gap-3">
                                                    {availableNotebooks.map(nb => (
                                                        <button
                                                            key={nb.id}
                                                            onClick={() => handleSelectNotebook(nb.id)}
                                                            className="w-full text-left p-4 rounded-2xl bg-white/[0.02] hover:bg-cyan-500/[0.04] border border-white/5 hover:border-cyan-500/30 transition-all group flex items-center justify-between shadow-xl shadow-black/20"
                                                        >
                                                            <div className="flex items-center gap-5 min-w-0">
                                                                <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20 transition-all shadow-inner">
                                                                    <span className="text-xl opacity-60 group-hover:opacity-100 transition-opacity">📓</span>
                                                                </div>
                                                                <div className="truncate">
                                                                    <span className="text-[14px] font-black text-white/60 group-hover:text-white transition-colors block leading-tight">{nb.title}</span>
                                                                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/10 group-hover:text-cyan-500/40 transition-colors">Repositorio de Investigación</span>
                                                                </div>
                                                            </div>
                                                            <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 pr-2">
                                                                <span className="text-cyan-500 font-black text-xs">Cargar</span>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {isLoadingNotebooks && (
                                            <div className="flex items-center justify-center gap-2 py-4">
                                                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]" />
                                                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.15s]" />
                                                <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce" />
                                            </div>
                                        )}
                                    </div>
                                    )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-slate-950/40 to-transparent">
                    {messages.map((m, i) => (
                        <div key={i} className={`flex flex-col gap-3 ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                            {/* Role Indicator */}
                            <div className={`flex items-center gap-2 px-1 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] shadow-sm ${
                                    m.role === 'user' 
                                    ? 'bg-white/10 text-white/40 border border-white/5' 
                                    : 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30'
                                }`}>
                                    {m.role === 'user' ? 'U' : 'AI'}
                                </div>
                                <span className="text-[14px] font-black uppercase tracking-[0.2em] text-white/20">
                                    {m.role === 'user' ? 'Delegado' : 'Co-Pilot'}
                                </span>
                            </div>

                            {/* Message Bubble */}
                            <div className={`relative group max-w-[92%] p-5 rounded-[24px] shadow-2xl transition-all ${
                                m.role === 'user' 
                                ? 'bg-gradient-to-br from-white/[0.08] to-transparent text-white border border-white/10 rounded-tr-none' 
                                : 'bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent text-cyan-50/90 border border-cyan-500/20 backdrop-blur-xl rounded-tl-none font-medium leading-relaxed'
                            }`}>
                                <div className={`markdown-content ${m.role === 'ai' ? 'text-[20px]' : 'text-[20px]'}`}>
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                                            ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-4 space-y-2" {...props} />,
                                            ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-4 space-y-2" {...props} />,
                                            li: ({node, ...props}) => <li className="marker:text-cyan-500/50" {...props} />,
                                            strong: ({node, ...props}) => <strong className="font-black text-white decoration-cyan-500/30 underline-offset-2" {...props} />,
                                            code: ({node, ...props}) => <code className="bg-white/10 px-2 py-1 rounded text-cyan-400 font-mono text-[19px]" {...props} />,
                                        }}
                                    >
                                        {m.text}
                                    </ReactMarkdown>
                                </div>
                                
                                {m.action === 'generate-header' && (
                                    <div className="mt-4 pt-4 border-t border-cyan-500/10">
                                        <button 
                                            onClick={() => handleAISuggestion(`<p><i>Guiados por</i> los principios de la Carta de las Naciones Unidas,</p>`)}
                                            className="w-full py-2.5 rounded-xl bg-cyan-500 text-black text-[11px] font-black uppercase shadow-lg shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                                        >
                                            + Insertar Cláusula Guía
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* NOTEBOOK BIBLIOGRAPHY CARDS (NUEVO DISEÑO DE ACCIÓN DIRECTA) */}
                            {m.notebook_citations && m.notebook_citations.length > 0 && (
                                <div className="w-full space-y-3 mt-4 animate-in fade-in zoom-in-95 duration-700">
                                    <div className="flex items-center gap-2 ml-1 mb-1">
                                        <div className="h-px w-4 bg-cyan-500/30" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400/60">
                                            📚 Evidencia de Cuaderno — Click para insertar
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {m.notebook_citations.map((cit, j) => (
                                            <div key={j} className="group relative bg-[#0a1628]/60 border border-white/5 rounded-[24px] p-4 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all cursor-pointer shadow-xl shadow-black/40 box-border"
                                                 onClick={() => handleAISuggestion(
                                                    `<p><i>"${cit.text_segment}"</i> (${cit.source_title}${cit.page_number ? `, pág. ${cit.page_number}` : ''})</p>`
                                                 )}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center shrink-0 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/30 transition-all">
                                                        <span className="text-xs group-hover:rotate-12 transition-transform">📖</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="text-[15px] font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg uppercase tracking-tight">
                                                                {cit.source_title}
                                                            </span>
                                                            {cit.page_number && (
                                                                <span className="text-[14px] font-black text-white/40">
                                                                    Pág. {cit.page_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[19px] text-white/60 leading-relaxed line-clamp-3 group-hover:text-white/90 transition-colors italic">
                                                            "{cit.text_segment}"
                                                        </p>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 shrink-0">
                                                        <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/40">
                                                            <span className="text-black font-black text-[12px]">+</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Botón de Cita APA Global Mejorado */}
                                    <div className="flex justify-end mt-4">
                                        <button 
                                            onClick={async () => {
                                                const sourceTitles = m.notebook_citations?.map(c => c.source_title).join(", ") || "documentos del cuaderno";
                                                const citePrompt = `Genera una LISTA bibliográfica profesional completa en formato APA 7ma edición para las siguientes fuentes: ${sourceTitles}. Devuelve ÚNICAMENTE la lista, sin textos adicionales.`;
                                                try {
                                                    const response = await fetch('http://localhost:8000/api/v1/chat', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            messages: [{ role: 'user', text: citePrompt }],
                                                            topic: params.topic,
                                                            country: params.delegation,
                                                            committee: committeeId,
                                                            notebookId: notebookId
                                                        })
                                                    });
                                                    const data = await response.json();
                                                    const cleanBiblio = data.response.trim()
                                                        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold: **text**
                                                        .replace(/__(.*?)__/g, '<b>$1</b>')     // Bold: __text__
                                                        .replace(/\*(.*?)\*/g, '<i>$1</i>')     // Italic: *text*
                                                        .replace(/_(.*?)_/g, '<i>$1</i>')       // Italic: _text_
                                                        .split('\n')
                                                        .filter((l: string) => l.trim().length > 5 && !l.toLowerCase().includes('bibliografía'))
                                                        .map((line: string) => `<p style="padding-left: 2em; text-indent: -2em; margin-bottom: 0.8em; font-size: 11.5pt; font-family: 'Times New Roman', Times, serif; line-height: 1.5; color: #000; text-align: left;">${line.trim()}</p>`)
                                                        .join('');
                                                    
                                                    handleAISuggestion(`<br/><div style="margin-top:40px; border-top: 2px solid #333; padding-top:20px; color: #000; background: #fff; padding: 30px; border: 1px solid #ddd;"><p style="text-align: center; font-size: 14pt; font-family: 'Times New Roman', serif; font-weight: bold; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 1px;">BIBLIOGRAFÍA</p>${cleanBiblio}</div>`);
                                                    setMessages(prev => [...prev, { role: 'ai', text: `✅ **Bibliografía APA integrada al final del documento.**` }]);
                                                } catch (err) {}
                                            }}
                                            className="w-full py-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-[12px] font-black uppercase text-cyan-400 hover:bg-cyan-500 hover:text-black hover:border-cyan-500 transition-all shadow-lg shadow-cyan-500/5"
                                        >
                                            📜 Insertar Bibliografía Completa del Cuaderno
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* CITED ARTICLES (ONU RAG) - DISEÑO PREMIUM UNIFICADO */}
                            {m.cited_articles && m.cited_articles.length > 0 && (
                                <div className="w-full space-y-3 mt-4 animate-in fade-in slide-in-from-right-4 duration-700">
                                    <div className="flex items-center gap-2 ml-1 mb-1">
                                        <div className="h-px w-4 bg-purple-500/30" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-400/60">
                                            ⚖️ Marco Jurídico ONU — Click para insertar
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {m.cited_articles.map((art, j) => (
                                            <div key={j} className="group relative bg-[#110c1d]/60 border border-white/5 rounded-[24px] p-4 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all cursor-pointer shadow-xl shadow-black/40 box-border"
                                                 onClick={() => handleAISuggestion(
                                                    `<p><i>Recordando</i> lo establecido en el <b>Artículo ${art.article_id}</b> de la <i>"${art.treaty}"</i>, que dispone: <i>"${art.text}"</i></p>`
                                                 )}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20 group-hover:border-purple-500/30 transition-all">
                                                        <span className="text-xs group-hover:scale-110 transition-transform">⚖️</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className="text-[15px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg uppercase tracking-tight">
                                                                Art. {art.article_id}
                                                            </span>
                                                            <span className="text-[14px] font-black text-white/40 uppercase truncate max-w-[200px]">
                                                                {art.treaty}
                                                            </span>
                                                        </div>
                                                        <p className="text-[19px] text-white/60 leading-relaxed line-clamp-3 group-hover:text-white/90 transition-colors">
                                                            "{art.text}"
                                                        </p>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0 shrink-0">
                                                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/40">
                                                            <span className="text-white font-black text-[12px]">+</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {isChatLoading && (
                        <div className="flex flex-col items-start gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
                             <div className="flex items-center gap-2 px-1">
                                <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30 flex items-center justify-center text-[10px]">AI</div>
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-cyan-500 animate-pulse">Consultando protocolos...</span>
                            </div>
                            <div className="p-6 rounded-[24px] rounded-tl-none bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 backdrop-blur-md">
                                <div className="flex gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-6 bg-slate-950/60 backdrop-blur-3xl border-t border-white/10">
                    <div className="relative group transition-all">
                        <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Interrogar al Co-Pilot y biblioteca..."
                            className="w-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-[32px] p-5 pr-14 text-[20px] font-medium outline-none focus:border-cyan-500/40 focus:bg-white/[0.08] transition-all h-20 shadow-inner resize-none custom-scrollbar placeholder:text-white/20"
                        />
                        <button 
                            onClick={handleSendMessage}
                            disabled={isChatLoading || !chatInput.trim()}
                            className={`absolute right-3 top-3 w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-xl ${
                                isChatLoading || !chatInput.trim() 
                                ? 'bg-white/5 text-white/10 border border-white/5' 
                                : 'bg-cyan-500 text-black hover:scale-110 active:scale-95 hover:rotate-2 shadow-cyan-500/20'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
        </div>

        {/* Sandbox Terminal Bottom Panel - Dynamic Sizes */}
        {terminalSizeMode !== 'off' && (
          <div className={`
             transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) 
             shrink-0 rounded-[32px] shadow-[0_-10px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden relative border border-cyan-500/20
             ${terminalSizeMode === 'compact' ? 'h-64' : ''}
             ${terminalSizeMode === 'mid' ? 'h-[55vh]' : ''}
             ${terminalSizeMode === 'full' ? 'fixed inset-4 z-[200] !h-auto' : ''}
          `}>
            <TerminalAgentUI 
                documentContext={editorContent} 
                onClose={() => setTerminalSizeMode('off')}
                onToggleExpand={() => {
                   if (terminalSizeMode === 'compact') setTerminalSizeMode('mid');
                   else if (terminalSizeMode === 'mid') setTerminalSizeMode('full');
                   else setTerminalSizeMode('compact');
                }}
            />
          </div>
        )}
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

                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase opacity-40 ml-3">Modo de Investigación</label>
                        <button 
                            onClick={() => setParams({...params, deepResearch: !params.deepResearch})}
                            className={`w-full h-11 rounded-2xl border transition-all flex items-center justify-between px-5 ${
                                params.deepResearch 
                                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' 
                                : 'bg-white/5 border-white/10 text-white/40'
                            }`}
                        >
                            <span className="text-xs font-bold uppercase tracking-tight">
                                {params.deepResearch ? '⚡ Investigación Profunda (Perplexity Mode)' : 'Estándar'}
                            </span>
                            <div className={`w-4 h-4 rounded-full transition-all ${params.deepResearch ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-white/10'}`} />
                        </button>
                        <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest ml-3">
                            {params.deepResearch 
                                ? 'Múltiples consultas, verificación de fuentes y análisis diplomático exhaustivo.' 
                                : 'Búsqueda web directa y rápida.'}
                        </p>
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
