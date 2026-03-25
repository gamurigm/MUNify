'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface TerminalMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
}

interface KnowledgeSource {
  title: string;
  domain: string;
  snippet: string;
  url: string;
  full_text?: string;  // Texto completo original de la web para búsqueda profunda
}

interface ActiveQuestion {
  type: string;
  question: string;
  source_index?: string;
  suggested_topics?: string[];
}

interface TerminalAgentUIProps {
  documentContext?: string;
  engineeringContext?: string;  // Content from .md files (Context Engineering)
  onClose?: () => void;
  onToggleExpand?: () => void;
}

export default function TerminalAgentUI({ 
  documentContext = "", 
  engineeringContext = "",
  onClose, 
  onToggleExpand 
}: TerminalAgentUIProps) {
  const params = useParams();
  const committeeId = params?.committeeId || 'global';

  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeSource[]>([]);
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [showKnowledgeHub, setShowKnowledgeHub] = useState(false);
  const [hubSearchQuery, setHubSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [autoRefine, setAutoRefine] = useState(true);
  const [lastRefineTime, setLastRefineTime] = useState<number>(0);
  const [activeQuestions, setActiveQuestions] = useState<ActiveQuestion[]>([]);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // --- PERSISTENCE LOGIC ---
  useEffect(() => {
    const storedKb = localStorage.getItem(`munify_kb_${committeeId}`);
    const storedMsgs = localStorage.getItem(`munify_msgs_${committeeId}`);
    
    if (storedKb) {
      try { setKnowledgeBase(JSON.parse(storedKb)); } catch(e) { console.error(e) }
    }
    
    if (storedMsgs) {
      try { setMessages(JSON.parse(storedMsgs)); } catch(e) { console.error(e) }
    } else {
      setMessages([
        { role: 'system', content: 'MUNify Drafting Terminal v2.1.0_beta initialized.' },
        { role: 'system', content: `Session linked to encrypted sector: ${committeeId}` },
        { role: 'system', content: 'Connection to Scribe Mainframe established.' },
        { role: 'agent', content: 'Saludos, delegado. ¿En qué sección del Documento Oficial necesitas ayuda, o qué datos de investigación necesitas recuperar de la matriz?' }
      ]);
    }
    setIsLoaded(true);
  }, [committeeId]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(`munify_kb_${committeeId}`, JSON.stringify(knowledgeBase));
    }
  }, [knowledgeBase, isLoaded, committeeId]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(`munify_msgs_${committeeId}`, JSON.stringify(messages));
    }
  }, [messages, isLoaded, committeeId]);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // === FEEDBACK SENDER (Fire-and-forget) ===
  const sendFeedback = (action: 'inject' | 'delete' | 'promote', source: KnowledgeSource) => {
    fetch(`http://${window.location.hostname}:8000/api/v1/queue/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        committee_id: String(committeeId),
        action,
        source: { title: source.title, domain: source.domain, snippet: source.snippet, url: source.url },
      }),
    }).catch(() => {}); // Silent — don't interrupt UX
  };

  // === AUTONOMOUS QUEUE REFINER LOOP ===
  useEffect(() => {
    if (!autoRefine || !isLoaded) return;

    const REFINE_INTERVAL = 45_000; // 45 seconds

    const refineLoop = setInterval(async () => {
      // Only refine if we have sources and aren't busy
      if (knowledgeBase.length < 2 || isLoading || isRefining) return;

      setIsRefining(true);
      try {
        const res = await fetch(`http://${window.location.hostname}:8000/api/v1/queue/refine`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sources: knowledgeBase,
            committee_id: String(committeeId),
            document_context: documentContext,
            engineering_context: engineeringContext,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          
          // Only update if the AI actually changed something
          if (data.actions_taken && data.actions_taken.length > 0) {
            setKnowledgeBase(data.refined_sources);
            
            let report = `🔄 [AUTO-REFINE v2] ${data.summary}\n`;
            data.actions_taken.forEach((a: string) => { report += `  → ${a}\n`; });
            if (data.gaps && data.gaps.length > 0) {
              report += `⚠️ HUECOS DETECTADOS:\n`;
              data.gaps.forEach((g: string) => { report += `  • ${g}\n`; });
            }
            if (data.utility_scores && data.utility_scores.length > 0) {
              const topScore = Math.max(...data.utility_scores).toFixed(3);
              report += `📊 Top Utility Score: ${topScore}\n`;
            }
            setMessages(prev => [...prev, { role: 'system', content: report }]);

            // Handle Active Learning questions
            if (data.questions && data.questions.length > 0) {
              setActiveQuestions(data.questions);
              data.questions.forEach((q: ActiveQuestion) => {
                setMessages(prev => [...prev, { role: 'system', content: `❓ [ACTIVE LEARNING] ${q.question}` }]);
              });
            }
          }
          setLastRefineTime(Date.now());
        }
      } catch {
        // Silent fail — don't spam the user if the backend is down
      } finally {
        setIsRefining(false);
      }
    }, REFINE_INTERVAL);

    return () => clearInterval(refineLoop);
  }, [autoRefine, isLoaded, knowledgeBase.length, isLoading, isRefining, committeeId, documentContext, engineeringContext]);

  // Priority Queue Actions
  const handleMoveSource = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && knowledgeBase[index]) {
      sendFeedback('promote', knowledgeBase[index]);
    }
    setKnowledgeBase(prev => {
      const newKb = [...prev];
      if (direction === 'up' && index > 0) {
        [newKb[index], newKb[index - 1]] = [newKb[index - 1], newKb[index]];
      } else if (direction === 'down' && index < newKb.length - 1) {
        [newKb[index], newKb[index + 1]] = [newKb[index + 1], newKb[index]];
      }
      return newKb;
    });
  };

  const handleDeleteSource = (index: number) => {
    if (knowledgeBase[index]) {
      sendFeedback('delete', knowledgeBase[index]);
    }
    setKnowledgeBase(prev => prev.filter((_, i) => i !== index));
    setMessages(prev => [...prev, { role: 'system', content: `[DATA_PURGED] Fuente #${index + 1} eliminada de la cola de procesamiento. (Feedback registrado ✓)` }]);
  };

  const handleInjectSource = (source: KnowledgeSource) => {
    sendFeedback('inject', source);
    // Generar formato de cita formal estilo APA simplificado
    const dateStr = new Date().getFullYear().toString();
    const domainName = source.domain.charAt(0).toUpperCase() + source.domain.slice(1).split('.')[0];
    const formalCitation = `(${domainName}, ${dateStr})`;
    
    const injection = `<br><br><blockquote>"${source.snippet}"<br>— <em>${source.title}</em> ${formalCitation}<br>Recuperado de: <a href="${source.url}">${source.url}</a></blockquote><br>`;
    
    window.dispatchEvent(new CustomEvent('insert-ai-content', { detail: injection }));
    setMessages(prev => [...prev, { role: 'system', content: `[EXTRACCIÓN] Inyectando datos referenciados de ${source.domain} al Canvas principal. (Feedback registrado ✓)` }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const fullInput = input.trim();
    const [cmd, ...args] = fullInput.toLowerCase().split(' ');
    setInput('');

    // --- MANEJO DE COMANDOS LOCALES (SHELL EMULATION) ---
    if (cmd === 'clear') {
       setMessages([]);
       return;
    }
    
    if (cmd === 'ls' && args.length === 0) {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       const sizeStr = documentContext.length > 1024 ? `${(documentContext.length / 1024).toFixed(1)} KB` : `${documentContext.length} B`;
       const list = `[ITEM] SYS | draft.canvas | Document context (${sizeStr})\n[ITEM] SYS | research.queue | Index array (${knowledgeBase.length} Items)`;
       setMessages(prev => [...prev, { role: 'system', content: `=== VIRTUAL SYSTEM RESOURCES ===\n${list}\n-> Usa 'cat draft.canvas' para inspeccionar qué texto le está llegando al Agente.` }]);
       return;
    }

    if (cmd === 'ls' && args.includes('-k')) {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       if (knowledgeBase.length === 0) {
          setMessages(prev => [...prev, { role: 'system', content: '[REPO] No hay fuentes indexadas actualmente. Inicia una investigación profunda primero.' }]);
          return;
       }
       // Generador Especializado (Protocolo Visual)
       const list = knowledgeBase.map((s, i) => `[ITEM] ID:${i+1} | ${s.domain} | ${s.title}\n[SNIPPET] ${s.snippet}`).join('\n');
       setMessages(prev => [...prev, { role: 'system', content: `=== KNOWLEDGE PRIORITY QUEUE (${knowledgeBase.length} Items) ===\n${list}\n-> Usa 'cat [ID]' para extraer al Canvas, o 'find [texto]' para filtrar.` }]);
       return;
    }

    if (cmd === 'find' && args.length > 0) {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       // Multi-word partial matching: ALL words must appear somewhere across all fields
       const queryWords = args.join(' ').toLowerCase().split(/\s+/).filter(w => w.length > 0);
       
       const matches = knowledgeBase.reduce((acc, s, index) => {
         // Concatenamos TODOS los campos incluyendo texto completo para búsqueda profunda
         const haystack = `${s.title} ${s.snippet} ${s.full_text || ''} ${s.domain} ${s.url}`.toLowerCase();
         const allMatch = queryWords.every(word => haystack.includes(word));
         if (allMatch) {
           acc.push({ originalIndex: index, source: s });
         }
         return acc;
       }, [] as {originalIndex: number, source: KnowledgeSource}[]);
       
       if (matches.length > 0) {
           const list = matches.map(m => `[ITEM] MATCH_ID:${m.originalIndex + 1} | ${m.source.domain} | ${m.source.title}\n[SNIPPET] ${m.source.snippet}`).join('\n');
           setMessages(prev => [...prev, { role: 'system', content: `=== BÚSQUEDA PROFUNDA: '${queryWords.join(' ')}' (${matches.length} coincidencias en título+snippet+dominio+url) ===\n${list}\n-> Usa 'cat [ID]' para inyectar.` }]);
       } else {
           setMessages(prev => [...prev, { role: 'system', content: `[FIND] No se encontraron coincidencias profundas para: '${queryWords.join(' ')}'. Se buscó en título, snippet, dominio y URL.` }]);
       }
       return;
    }

    if (cmd === 'flush') {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       const count = knowledgeBase.length;
       setKnowledgeBase([]);
       setMessages(prev => [...prev, { role: 'system', content: `[FLUSH] Cola de Prioridad vaciada. ${count} fuentes eliminadas. Lista para una nueva sesión de investigación.` }]);
       return;
    }

    if (cmd === 'cat' && args.length > 0) {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       
       if (args[0] === 'draft.canvas' || args[0] === 'draft') {
          // Limpiar el HTML para que sea legible en modo consola purista
          const cleanText = documentContext.replace(/<[^>]*>/g, '').trim();
          const display = cleanText ? cleanText : '[CANVAS VACÍO]';
          // Mostrar sólo un extracto si es demasiado largo para evitar romper la UI
          const truncated = display.length > 1500 ? display.substring(0, 1500) + '...\n\n[OUTPUT TRUNCATED (Mostrando solo los primeros 1.5K docs)]' : display;
          
          setMessages(prev => [...prev, { role: 'system', content: `=== LEÍDO DESDE: draft.canvas (Modo Texto) ===\n[SNIPPET] ${truncated}\n-> Este es el contexto exacto al que el Agente tiene acceso (Límite: 30K chars).` }]);
          return;
       }

       const id = parseInt(args[0]) - 1;
       if (!isNaN(id) && knowledgeBase[id]) {
          handleInjectSource(knowledgeBase[id]);
       } else {
          setMessages(prev => [...prev, { role: 'system', content: `[ERROR] ID de fuente inválido o recurso inexistente: ${args[0]}` }]);
       }
       return;
    }

    if (cmd === 'debate' && args.length > 0) {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       const kbCount = knowledgeBase.length;
       setMessages(prev => [...prev, { role: 'system', content: `⚔️ Generando análisis con ${kbCount} fuentes de la Cola de Prioridad como evidencia...` }]);
       setIsLoading(true);
       try {
         const topic = args.join(' ');
         // Compilar el contexto de la cola de prioridad
         const sourceContext = knowledgeBase.map((s, i) => 
           `[Fuente ${i+1}] ${s.title} (${s.domain}): ${s.snippet}`
         ).join('\n');
         const res = await fetch(`http://${window.location.hostname}:8000/api/v1/chat/arguments`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             topic, 
             country: 'Delegación', 
             committee: String(committeeId),
             parameters: knowledgeBase.map(s => `${s.title}: ${s.snippet.substring(0, 150)}`),
             source_context: sourceContext,
           }),
         });
         const data = await res.json();
         
         let output = `=== ⚔️ DEBATE ANALYSIS: ${topic.toUpperCase()} ===\n\n`;
         output += `✅ ARGUMENTOS A FAVOR:\n`;
         (data.arguments_for || []).forEach((a: any, i: number) => {
           output += `[ITEM] FOR_${i+1} | ${a.strength?.toUpperCase() || 'N/A'} | ${a.point}\n[SNIPPET] ${a.detail}\n[SNIPPET] 📜 Base Legal: ${a.legal_basis}\n`;
         });
         output += `\n❌ ARGUMENTOS EN CONTRA:\n`;
         (data.arguments_against || []).forEach((a: any, i: number) => {
           output += `[ITEM] AGN_${i+1} | ${a.strength?.toUpperCase() || 'N/A'} | ${a.point}\n[SNIPPET] ${a.detail}\n[SNIPPET] 📜 Base Legal: ${a.legal_basis}\n`;
         });
         output += `\n-> Usa estos argumentos para fortalecer tu posición en la negociación.`;
         
         setMessages(prev => [...prev, { role: 'system', content: output }]);
       } catch (e) {
         setMessages(prev => [...prev, { role: 'system', content: `[ERROR] No se pudo generar el análisis: ${e}` }]);
       } finally {
         setIsLoading(false);
       }
       return;
    }

    if (cmd === 'scan') {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       const scanTopic = args.length > 0 ? args.join(' ') : '';
       setIsLoading(true);
       setMessages(prev => [...prev, { role: 'system', content: `[SCAN INICIADO] Consultando TODOS los cuadernos conectados...` }]);
       
       try {
         // 1. Fetch all available notebooks
         const nbRes = await fetch(`http://${window.location.hostname}:8000/api/v1/notebooks`);
         if (!nbRes.ok) throw new Error('No se pudo conectar con NotebookLM');
         const nbData = await nbRes.json();
         const notebooks = nbData.notebooks || [];
         
         if (notebooks.length === 0) {
           setMessages(prev => [...prev, { role: 'system', content: `[SCAN] No hay cuadernos conectados. Sube archivos desde la interfaz principal primero.` }]);
           setIsLoading(false);
           return;
         }

         setMessages(prev => [...prev, { role: 'system', content: `[SCAN] Encontrados ${notebooks.length} cuaderno(s): ${notebooks.map((n: any) => n.title).join(', ')}` }]);

         // 2. Build the query prompt
         const queryTopic = scanTopic || 'Extrae los datos, argumentos y evidencias más relevantes de todos los documentos';

         // 3. Query ALL notebooks in parallel
         const promises = notebooks.map((nb: any) => 
           fetch(`http://${window.location.hostname}:8000/api/v1/notebook-analyze`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               notebook_id: nb.id,
               topic: queryTopic,
               context: documentContext.substring(0, 2000),
             })
           })
         );

         const results = await Promise.allSettled(promises);
         const newSources: KnowledgeSource[] = [];
         let totalExtracted = 0;

         for (let i = 0; i < results.length; i++) {
           const result = results[i];
           const nbTitle = notebooks[i]?.title || `Cuaderno ${i+1}`;
           
           if (result.status === 'fulfilled' && result.value instanceof Response && result.value.ok) {
             const data = await result.value.json();
             if (data.sources) {
               data.sources.forEach((s: any) => {
                 newSources.push({
                   title: `[${nbTitle}] ${s.title}`,
                   domain: 'NotebookLM',
                   snippet: s.snippet,
                   url: s.url || 'notebook://local',
                   full_text: s.snippet,
                 });
                 totalExtracted++;
               });
             }
             setMessages(prev => [...prev, { role: 'system', content: `  ✓ ${nbTitle}: ${data.source_count || 0} extractos` }]);
           } else {
             setMessages(prev => [...prev, { role: 'system', content: `  ✗ ${nbTitle}: Error al consultar` }]);
           }
         }

         if (newSources.length > 0) {
           setKnowledgeBase(prev => [...newSources, ...prev]);
           setShowKnowledgeHub(true);
           setMessages(prev => [...prev, { 
             role: 'system', 
             content: `[SCAN COMPLETADO] ${totalExtracted} extractos de ${notebooks.length} cuaderno(s) añadidos a la Cola de Prioridad. Tema: "${queryTopic}"` 
           }]);
         } else {
           setMessages(prev => [...prev, { role: 'system', content: `[SCAN] No se extrajeron resultados. Verifica que los cuadernos tengan documentos cargados.` }]);
         }
       } catch (e) {
         setMessages(prev => [...prev, { role: 'system', content: `[ERROR] Falló el escaneo de cuadernos: ${e}` }]);
       } finally {
         setIsLoading(false);
       }
       return;
    }

    if (cmd === 'help') {
       setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
       const helpText = `COMANDOS DISPONIBLES:\n- ls         : Lista los recursos virtuales del entorno.\n- ls -k      : Lista las fuentes de conocimiento indexadas.\n- cat [ID]   : Extrae e inyecta la fuente con ese ID (ej: cat 1).\n- cat draft  : Inspecciona el texto detectado del Canvas en vivo.\n- find [str] : Búsqueda profunda multi-campo (título, snippet, dominio, URL).\n- scan [tema]: Escanea TODOS los cuadernos NotebookLM y añade extractos a la Cola.\n- flush      : Vacía la Cola de Prioridad para nueva sesión.\n- debate [t] : Genera argumentos A FAVOR y EN CONTRA sobre un tema.\n- clear      : Limpia el historial de la pantalla.\n- help       : Muestra este mensaje de ayuda.`;
       setMessages(prev => [...prev, { role: 'system', content: helpText }]);
       return;
    }

    // --- PROCESAMIENTO AI NORMAL ---
    setMessages(prev => [...prev, { role: 'user', content: fullInput }]);
    setIsLoading(true);

    try {
      // Filtrar los mensajes de sistema puramente visuales
      const historyToSend = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(`http://${window.location.hostname}:8000/api/v1/agent/drafting-terminal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: fullInput,
          document_context: documentContext,
          history: historyToSend
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'agent', content: data.answer }]);

        // PHASE 3: OPEN CLAW DRAFTER (BACKGROUND)
        if (data.action === 'draft' && data.new_draft) {
           window.dispatchEvent(new CustomEvent('overwrite-ai-content', { detail: data.new_draft }));
        }

        // PHASE 2: OPEN CLAW DEEP RESEARCH (BACKGROUND)
        if (data.action === 'trigger_research') {
           setIsLoading(true);
           setMessages(prev => [...prev, { role: 'system', content: `[DEEP RESEARCH INICIADO] Configurando iteración en LangGraph para: ${data.research_topic}` }]);
           try {
              const drRes = await fetch(`http://${window.location.hostname}:8000/api/v1/deep-research`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ 
                    topic: data.research_topic, 
                    country: 'Terminal-Delegado', 
                    context: data.research_context,
                    round: 1
                 })
              });
              
              if (drRes.ok) {
                 const drData = await drRes.json();
                 const sources = drData.sources.map((s:any) => ({
                    title: s.title,
                    domain: s.domain,
                    snippet: s.snippet,
                    url: s.url,
                    full_text: s.full_text || '',
                 }));

                 setKnowledgeBase(prev => [...sources, ...prev]); // Insertar al principio de la cola
                 setShowKnowledgeHub(true);

                 setMessages(prev => [
                    ...prev, 
                    { role: 'system', content: `[DEEP RESEARCH COMPLETADO] Se han apilado ${sources.length} nuevas fuentes en la cima de la cola. Visualizando Repositorio.` },
                    { role: 'agent', content: `✅ He extraído exhaustivamente fuentes nuevas libres. Puedes organizarlas en el Knowledge Hub (Icono 📚).` }
                 ]);
              }
           } catch (e) {
              setMessages(prev => [...prev, { role: 'system', content: `[ERROR] Falló la investigación profunda aislada.` }]);
           }
        }

        // PHASE 4: MIXED PARALLEL RESEARCH (NOTEBOOK + WEB) — Multi-Notebook
        if (data.action === 'trigger_mixed_research') {
           setIsLoading(true);
           
           // Collect ALL connected notebook IDs (not just the active one)
           const activeNbId = localStorage.getItem(`active_notebook_id_${committeeId}`);
           const allNbIds: string[] = [];
           try {
              const nbListRes = await fetch(`http://${window.location.hostname}:8000/api/v1/notebooks`);
              if (nbListRes.ok) {
                 const nbListData = await nbListRes.json();
                 (nbListData.notebooks || []).forEach((nb: any) => { if (nb.id) allNbIds.push(nb.id); });
              }
           } catch { /* silent */ }
           // Fallback to single active notebook if list failed
           if (allNbIds.length === 0 && activeNbId) allNbIds.push(activeNbId);
           
           setMessages(prev => [...prev, { role: 'system', content: `[ENJAMBRE MULTI-CUADERNO INICIADO] Consultando ${allNbIds.length} cuaderno(s) + Deep Research para: ${data.research_topic}` }]);
           
           try {
              // Web research
              const p1 = fetch(`http://${window.location.hostname}:8000/api/v1/deep-research`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ 
                    topic: data.research_topic, 
                    country: 'Terminal-Delegado', 
                    context: data.research_context,
                 })
              });
              
              // Multi-notebook queries (parallel map)
              const nbPromises = allNbIds.map((nbId: string) => 
                 fetch(`http://${window.location.hostname}:8000/api/v1/notebook-analyze`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                       notebook_id: nbId,
                       topic: data.research_topic,
                       context: data.research_context
                    })
                 })
              );

              const allResults = await Promise.allSettled([p1, ...nbPromises]);
              
              const newSources: KnowledgeSource[] = [];
              let nbCount = 0;
              let drCount = 0;

              // First result is Deep Research
              const drObj = allResults[0];
              if (drObj.status === 'fulfilled' && drObj.value instanceof Response && drObj.value.ok) {
                 const drData = await drObj.value.json();
                 if (drData.sources) {
                    drData.sources.forEach((s: any) => {
                       newSources.push({ title: s.title, domain: s.domain, snippet: s.snippet, url: s.url, full_text: s.full_text || '' });
                       drCount++;
                    });
                 }
              }

              // Remaining results are Notebook queries
              for (let idx = 1; idx < allResults.length; idx++) {
                 const nbObj = allResults[idx];
                 if (nbObj.status === 'fulfilled' && nbObj.value instanceof Response && nbObj.value.ok) {
                    const nbData = await nbObj.value.json();
                    if (nbData.sources) {
                       nbData.sources.forEach((s: any) => {
                          newSources.push({ title: s.title, domain: s.domain || 'NotebookLM', snippet: s.snippet, url: s.url, full_text: s.full_text || '' });
                          nbCount++;
                       });
                    }
                 }
              }

              if (newSources.length > 0) {
                 setKnowledgeBase(prev => [...newSources, ...prev]);
                 setShowKnowledgeHub(true);
                 setMessages(prev => [
                    ...prev, 
                    { role: 'system', content: `[ENJAMBRE MULTI-CUADERNO COMPLETADO] Extraídos ${nbCount} fragmentos de ${allNbIds.length} cuaderno(s) y ${drCount} fuentes web. Cola actualizada.` },
                    { role: 'agent', content: `✅ Cross-referencia completa. He consultado ${allNbIds.length} cuaderno(s) simultáneamente. Evalúa los resultados en el Knowledge Hub (📚).` }
                 ]);
              } else {
                 setMessages(prev => [...prev, { role: 'system', content: `[AVISO] El enjambre multi-cuaderno no devolvió fuentes para este tema.` }]);
              }

           } catch (e) {
              setMessages(prev => [...prev, { role: 'system', content: `[ERROR] Falló el análisis de enjambre multi-cuaderno.` }]);
           }
        }

      } else {
        throw new Error('Server error');
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'system', content: '[ERR] Fallo de conexión con el enjambre AI.' }]);
    }
    setIsLoading(false);
  };

  const filteredKnowledge = knowledgeBase.filter(s => 
    s.title.toLowerCase().includes(hubSearchQuery.toLowerCase()) || 
    s.snippet.toLowerCase().includes(hubSearchQuery.toLowerCase()) ||
    s.domain.toLowerCase().includes(hubSearchQuery.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0a0f18]/95 backdrop-blur-xl">
      {/* Header — Clear resize controls */}
      <div className="h-11 shrink-0 border-b border-[#00e5ff]/20 bg-gradient-to-r from-[#00e5ff]/10 to-transparent flex items-center justify-between px-3 select-none">
        <div className="flex items-center gap-4">
          <div className="flex gap-2 mr-2">
            <div onClick={onClose} className="w-3 h-3 rounded-full bg-red-500 cursor-pointer hover:bg-red-400 transition" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
            <div onClick={onToggleExpand} className="w-3 h-3 rounded-full bg-green-500 cursor-pointer hover:bg-green-400 transition" />
          </div>
          <span className="text-[#00e5ff] font-mono text-[11px] font-bold tracking-widest opacity-80 uppercase">
             Matrix Sandbox :: Command_Center
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-Refine Toggle */}
          <button 
            onClick={() => setAutoRefine(!autoRefine)}
            className={`h-7 px-2 rounded-lg text-[9px] font-bold tracking-wider uppercase flex items-center gap-1 transition-all border ${autoRefine ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white/30 border-white/5'}`}
            title={autoRefine ? 'Auto-Refine ON (cada 45s)' : 'Auto-Refine OFF'}
          >
            {isRefining ? <span className="animate-spin">⟳</span> : '⟳'} Auto
          </button>
          {/* Priority Queue Toggle */}
          <button 
            onClick={() => setShowKnowledgeHub(!showKnowledgeHub)}
            className={`flex items-center gap-2 h-7 px-3 rounded-lg transition-all border ${showKnowledgeHub ? 'bg-[#00e5ff] text-black border-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.3)]' : 'bg-white/5 text-[#00e5ff] border-white/5 hover:bg-white/10 hover:border-[#00e5ff]/30'}`}
          >
            <span className="text-[10px] font-black tracking-wider uppercase">📚 Queue ({knowledgeBase.length})</span>
          </button>
          <span className="text-[#10b981] text-[8px] uppercase font-mono tracking-widest px-2 py-1 rounded-md bg-[#10b981]/10 border border-[#10b981]/20 animate-pulse hidden sm:inline">
            ● LIVE
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Terminal Output */}
        <div className={`flex-1 overflow-y-auto p-5 font-mono text-[13px] leading-relaxed flex flex-col custom-scrollbar relative transition-all duration-500 ${showKnowledgeHub ? 'opacity-40 scale-95 blur-sm' : ''}`}>
          
          {/* Animated Grid Overlay when loading */}
          {isLoading && (
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden bg-[#00e5ff]/[0.02]">
              <div className="absolute inset-0 grid-background opacity-20" />
              <div className="absolute inset-0 scanline-effect" />
            </div>
          )}

          {messages.map((msg, idx) => {
            if (msg.role === 'user') return (
              <div key={idx} className="mb-4 text-[#e2e8f0] animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#fca5a5] font-bold">root@munify-sandbox</span>
                  <span className="text-[#00e5ff] font-bold">~</span>
                  <span className="text-white/40">$</span>
                </div>
                <div className="pl-4 border-l-2 border-white/10 text-white/90">{msg.content}</div>
              </div>
            );
            
            if (msg.role === 'system') {
              // RENDERIZADOR VISUAL PRO PARA REPOS Y BÚSQUEDAS (Parsed Protocol)
              if (msg.content.startsWith('=== KNOWLEDGE PRIORITY QUEUE') || msg.content.startsWith('=== BÚSQUEDA FUZZY')) {
                  const lines = msg.content.split('\n');
                  const header = lines[0];
                  const rest = lines.slice(1);
                  return (
                    <div key={idx} className="mb-6 mt-2 p-4 bg-[#020617]/80 border border-[#00e5ff]/30 rounded-xl shadow-[0_4px_20px_rgba(0,229,255,0.05)] animate-in fade-in slide-in-from-bottom-2 duration-500 backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-4 border-b border-[#00e5ff]/20 pb-2">
                        <svg className="w-4 h-4 text-[#00e5ff] animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        <span className="text-[#00e5ff] font-black tracking-widest text-[11px] uppercase">{header}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {rest.map((line, i) => {
                          if (line.startsWith('[ITEM]')) {
                            const params = line.replace('[ITEM]', '').split('|').map(p => p.trim());
                            const idPart = params[0];
                            const domain = params[1] || '';
                            const title = params.slice(2).join(' | ');
                            return (
                              <div key={i} className="flex items-center gap-3 mt-4">
                                <span className="bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 px-2 py-0.5 rounded text-[10px] font-black tracking-widest shadow-[0_0_10px_rgba(0,229,255,0.2)]">
                                  {idPart}
                                </span>
                                <span className="bg-white/5 px-2 py-0.5 rounded text-white/50 uppercase text-[9px] tracking-widest font-mono border border-white/5">
                                  {domain}
                                </span>
                                <span className="text-white/90 font-bold text-[12px]">{title}</span>
                              </div>
                            );
                          }
                          if (line.startsWith('[SNIPPET]')) {
                            const snippet = line.replace('[SNIPPET]', '').trim();
                            return (
                              <div key={i} className="pl-4 ml-[1.65rem] mt-1 border-l-2 border-[#00e5ff]/40 text-[#94a3b8] text-[11px] leading-relaxed italic bg-gradient-to-r from-[#00e5ff]/[0.03] to-transparent py-2 rounded-r pr-2 shadow-inner">
                                "{snippet}"
                              </div>
                            );
                          }
                          if (line.startsWith('->')) {
                            return (
                              <div key={i} className="mt-5 flex items-center gap-2 text-[#00e5ff]/70 text-[10px] font-mono font-bold tracking-widest uppercase bg-[#00e5ff]/[0.02] px-3 py-2 rounded-lg border border-[#00e5ff]/10 w-fit">
                                <svg className="w-3 h-3 text-[#00e5ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {line.replace('-> ', '')}
                              </div>
                            );
                          }
                          if (line.trim() === '') return null;
                          return <div key={i} className="text-white/40 text-[10px]">{line}</div>;
                        })}
                      </div>
                    </div>
                  );
              }

              // MENSAJE DEL SISTEMA REGULAR
              const isError = msg.content.includes('[ERROR]') || msg.content.includes('[FIND]') || msg.content.includes('inválido');
              const isSuccess = msg.content.includes('COMPLETADO]') || msg.content.includes('[EXTRACCIÓN]') || msg.content.includes('RECUPERADO =');
              
              return (
                <div key={idx} className={`mb-4 border-l-4 p-3 bg-black/40 rounded-r shadow-md animate-in fade-in zoom-in-95 duration-500 
                  ${isError ? 'border-[#ef4444] text-[#ef4444]' : 
                    isSuccess ? 'border-[#10b981] text-[#34d399]' : 
                    'border-[#eab308] text-[#fde047]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                     <span className="font-bold text-[11px] tracking-widest uppercase">
                        {isError ? 'PROCESS_ERROR' : isSuccess ? 'PROCESS_SUCCESS' : 'SYSTEM_DAEMON'}
                     </span>
                  </div>
                  <div className="text-[12px] opacity-90 whitespace-pre-wrap">{msg.content}</div>
                </div>
              );
            }
            
            if (msg.role === 'agent') {
              return (
                <div key={idx} className="mb-6 animate-in slide-in-from-left-2 duration-500">
                  <div className="flex items-center gap-2 mb-1.5 border-b border-[#00e5ff]/20 pb-1">
                    <span className="text-[#00e5ff] font-bold uppercase text-[10px] tracking-widest px-1.5 py-0.5 bg-[#00e5ff]/10 rounded">OpenClaw Engine</span>
                    <span className="text-white/30 text-[10px]">v2.1.0_beta</span>
                  </div>
                  <div className="text-[#cbd5e1] whitespace-pre-wrap pl-2 leading-loose">
                    {/* Pseudo-Markdown Highlighting (Simple) */}
                    {msg.content.split('\n').map((line, i) => {
                      return <div key={i} className="min-h-[1em]">{line.startsWith('-') ? <span className="text-[#00e5ff] mr-2">»</span> : null}{line}</div>;
                    })}
                  </div>
                </div>
              );
            }
          })}

          {isLoading && (
            <div className="mb-4 mt-2">
              <div className="border border-[#00e5ff]/30 bg-[#00e5ff]/5 p-4 rounded-lg relative overflow-hidden shadow-[0_0_15px_rgba(0,229,255,0.1)]">
                 <div className="absolute top-0 left-0 h-0.5 bg-[#00e5ff] animate-[progress_2s_ease-in-out_infinite] w-1/3" />
                 <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-[#00e5ff] animate-ping" />
                   <div className="flex flex-col">
                     <span className="text-[#00e5ff] font-black text-[11px] uppercase tracking-widest">Ejecutando Job en The Grid...</span>
                     <span className="text-white/40 text-[10px]">Analizando contexto y generando árboles de decisión...</span>
                   </div>
                 </div>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        {/* Priority Knowledge Hub Overlay */}
        {showKnowledgeHub && (
          <div className="absolute inset-0 z-50 bg-[#020617]/95 backdrop-blur-2xl p-6 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-500">
            <div className="max-w-4xl mx-auto flex flex-col h-full">
              <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4 shrink-0">
                <div>
                  <h3 className="text-[#00e5ff] font-black text-xl uppercase tracking-widest">Knowledge Priority Queue</h3>
                  <p className="text-white/40 text-xs font-mono">Gestión visual y búsqueda fuzzy de inteligencia recolectada.</p>
                </div>
                <button onClick={() => setShowKnowledgeHub(false)} className="bg-white/5 hover:bg-white/10 text-white/40 hover:text-red-400 p-2 rounded-full transition shadow-lg">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Barra de Búsqueda Fuzzy */}
              <div className="relative mb-6 shrink-0">
                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Búsqueda Fuzzy (Dominios, Títulos, Extractos)..."
                  value={hubSearchQuery}
                  onChange={(e) => setHubSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm font-mono text-white outline-none focus:border-[#00e5ff]/50 focus:bg-[#00e5ff]/5 transition-all"
                />
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex flex-col gap-4">
                  {filteredKnowledge.length === 0 && (
                    <div className="py-20 text-center text-white/20 font-mono text-sm border-2 border-dashed border-white/5 rounded-3xl">
                      {hubSearchQuery ? "Ninguna fuente coincide con la búsqueda." : "No hay fuentes indexadas en la cola actualmente."}
                    </div>
                  )}
                  {filteredKnowledge.map((source, i) => {
                    // Encontrar el índice original en knowledgeBase
                    const originalIndex = knowledgeBase.findIndex(s => s === source);
                    
                    return (
                      <div key={originalIndex} className="relative bg-[#0a0f18] border border-white/10 rounded-xl hover:border-[#00e5ff]/40 transition-all overflow-hidden">
                        {/* Top bar: always visible actions */}
                        <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-[#00e5ff]/15 text-[#00e5ff] flex items-center justify-center text-[10px] font-black">{originalIndex + 1}</span>
                            <span className="px-2 py-0.5 bg-white/5 rounded text-[9px] text-[#00e5ff] font-mono border border-white/10 uppercase">{source.domain}</span>
                            <h4 className="text-white font-bold text-[12px] tracking-wide line-clamp-1">{source.title}</h4>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleMoveSource(originalIndex, 'up')} disabled={originalIndex === 0} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/15 text-white/40 hover:text-white disabled:opacity-20 flex items-center justify-center transition-all" title="Subir prioridad">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button onClick={() => handleMoveSource(originalIndex, 'down')} disabled={originalIndex === knowledgeBase.length - 1} className="w-6 h-6 rounded-md bg-white/5 hover:bg-white/15 text-white/40 hover:text-white disabled:opacity-20 flex items-center justify-center transition-all" title="Bajar prioridad">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            <button onClick={() => handleInjectSource(source)} className="h-6 px-2.5 rounded-md bg-[#00e5ff]/20 hover:bg-[#00e5ff] text-[#00e5ff] hover:text-black text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all border border-[#00e5ff]/30" title="Inyectar al Canvas">
                              ↗ Inject
                            </button>
                            <button onClick={() => handleDeleteSource(originalIndex)} className="w-6 h-6 rounded-md bg-red-500/10 hover:bg-red-500 text-red-400/60 hover:text-white flex items-center justify-center transition-all" title="Eliminar">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                        {/* Snippet */}
                        <div className="px-3 py-2">
                          <p className="text-white/50 text-[11px] leading-relaxed line-clamp-2">{source.snippet}</p>
                          <a href={source.url} target="_blank" rel="noreferrer" className="text-[#00e5ff]/40 hover:text-[#00e5ff] text-[9px] font-mono mt-1 inline-block">↗ {source.url?.substring(0, 60)}...</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input de la Terminal Constante */}
      <form 
        onSubmit={handleSubmit} 
        className="h-12 shrink-0 border-t border-[#00e5ff]/20 bg-black/60 backdrop-blur-3xl flex items-center px-6 relative z-[60]"
      >
        <span className="text-[#00e5ff] font-mono text-sm mr-4 font-bold animate-pulse">{">"}</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "Agente operando..." : "Investiga, filtra, o interroga al Co-Pilot (Tipea 'help' para comandos)..."}
          disabled={isLoading}
          className="flex-1 bg-transparent border-none outline-none text-[#00e5ff] font-mono text-[14px] placeholder:text-[#00e5ff]/20"
          autoFocus={true}
          autoComplete="off"
        />
        {isLoading && (
          <div className="flex gap-1 absolute right-6">
            <div className="w-1 h-1 bg-[#00e5ff] rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1 h-1 bg-[#00e5ff] rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1 h-1 bg-[#00e5ff] rounded-full animate-bounce" />
          </div>
        )}
      </form>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 229, 255, 0.2); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 229, 255, 0.4); }

        .grid-background {
          background-image: 
            linear-gradient(rgba(0, 229, 255, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.1) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        .scanline-effect {
          background: linear-gradient(
            to bottom,
            transparent,
            rgba(0, 229, 255, 0.05) 50%,
            transparent
          );
          height: 100px;
          width: 100%;
          position: absolute;
          animation: scan 3s linear infinite;
          opacity: 0.5;
        }

        @keyframes scan {
          from { transform: translateY(-100px); }
          to { transform: translateY(100vh); }
        }

        @keyframes progress {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
