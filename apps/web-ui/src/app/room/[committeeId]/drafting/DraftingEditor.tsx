'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import { yCursorPlugin } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Custom Collaboration Cursor extension to ensure compatibility with Tiptap v3 sync plugin
const LocalCollaborationCursor = Extension.create({
  name: 'collaborationCursor',
  addOptions() {
    return {
      provider: null,
      user: { name: null, color: null },
      render: (user: any) => {
        const cursor = document.createElement('span');
        cursor.classList.add('collaboration-cursor__caret');
        cursor.setAttribute('style', `border-color: ${user.color}; border-left: 2px solid ${user.color}; height: 1.2em; display: inline-block; position: relative;`);
        
        const label = document.createElement('div');
        label.classList.add('collaboration-cursor__label');
        label.setAttribute('style', `background-color: ${user.color}; position: absolute; top: -1.4em; left: -1px; font-size: 10px; color: white; padding: 2px 6px; border-radius: 3px; white-space: nowrap; font-weight: bold;`);
        label.innerText = user.name || 'Anónimo';
        
        cursor.appendChild(label);
        return cursor;
      },
    };
  },
  addProseMirrorPlugins() {
    if (!this.options.provider || !this.options.provider.awareness) {
      return [];
    }
    return [
      yCursorPlugin(this.options.provider.awareness, {
        cursorBuilder: this.options.render,
      }),
    ];
  },
});

interface Props {
  viewMode: 'edit' | 'latex';
  content: string;
  params: any;
  onContentChange: (content: string) => void;
}

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

export default function DraftingEditor({ viewMode, content, params, onContentChange }: Props) {
  const { committeeId } = useParams();
  const committeeKey = String(committeeId || '').toUpperCase();
  const committeeInfo = COMMITTEES[committeeKey];
  const [zoom, setZoom] = useState(1.1);

  // --- COLLABORATION SETUP ---
  // Create ydoc and provider in a single stable useMemo.
  const { ydoc, provider } = useMemo(() => {
    const doc = new Y.Doc();
    if (typeof window === 'undefined') return { ydoc: doc, provider: null };
    
    const roomName = `committee_${String(committeeId || '').toUpperCase() || 'default'}`;
    const wsProvider = new WebsocketProvider(
      `ws://${window.location.hostname}:1234`, 
      roomName, 
      doc
    );
    return { ydoc: doc, provider: wsProvider };
  }, [committeeId]);

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      provider?.disconnect();
      provider?.destroy();
      ydoc?.destroy();
    };
  }, [provider, ydoc]);

  // Update awareness when delegation or provider changes
  useEffect(() => {
    if (provider && provider.awareness) {
      const colors = ['#00f5ff', '#c44dff', '#ffec1a', '#ff4d4d', '#4dff88', '#ff9f43'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const currentState = provider.awareness.getLocalState();
      provider.awareness.setLocalStateField('user', {
        name: params?.delegation || 'Delegado Anónimo',
        color: currentState?.user?.color || randomColor,
      });
    }
  }, [params?.delegation, provider]);

  // Compute extensions once and keep them stable.
  const extensions = useMemo(() => {
    const list = [
      (StarterKit as any).configure({
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      Underline,
      TiptapImage.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: 'El lienzo está listo. Empieza a redactar o usa la IA...',
      }),
    ] as any[];

    if (provider) {
      list.push(
        LocalCollaborationCursor.configure({
          provider: provider,
          user: {
            name: params?.delegation || 'Delegado Anónimo',
            color: '#00f5ff',
          },
        })
      );
    }
    
    return list.filter(Boolean);
  }, [ydoc, provider, params?.delegation]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[600px] text-black pb-40',
        style: 'color: black !important;',
      },
    },
  }, [extensions]);

  // Listen for AI content insertion events
  useEffect(() => {
    const handleInsert = (e: any) => {
      if (editor) {
        editor.chain().focus().insertContent(e.detail).run();
      }
    };
    const handleOverwrite = (e: any) => {
      if (editor) {
        editor.commands.setContent(e.detail, true); // true = emit update event
      }
    };
    
    window.addEventListener('insert-ai-content', handleInsert);
    window.addEventListener('overwrite-ai-content', handleOverwrite);
    
    return () => {
      window.removeEventListener('insert-ai-content', handleInsert);
      window.removeEventListener('overwrite-ai-content', handleOverwrite);
    };
  }, [editor]);

  const addImage = () => {
    const url = window.prompt('URL de la imagen:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const toLaTeX = () => {
    if (!editor) return '';
    const html = editor.getHTML();
    const isRes = params.docType === 'Proyecto de Resolución';
    const isDec = params.docType === 'Declaración';
    
    let doc = `% MUNify Studio Professional UN Export\n`;
    doc += `\\documentclass[12pt, a4paper]{article}\n`;
    doc += `\\usepackage[utf8]{inputenc}\n`;
    doc += `\\usepackage[spanish]{babel}\n`;
    doc += `\\usepackage[margin=2.5cm, top=2.5cm, headheight=2.5cm]{geometry}\n`;
    doc += `\\usepackage{graphicx}\n`;
    doc += `\\usepackage{xcolor}\n`;
    doc += `\\usepackage{fancyhdr}\n`;
    doc += `\\usepackage{titlesec}\n`;
    doc += `\\usepackage{float}\n`;
    doc += `\\usepackage{hyperref}\n\n`;

    doc += `% Header Style (Strict UN Format)\n`;
    doc += `\\pagestyle{fancy}\n`;
    doc += `\\fancyhf{}\n`;
    doc += `\\fancyhead[L]{\\normalsize\\textbf{Naciones Unidas}}\n`;
    doc += `\\fancyhead[R]{\\small ${isRes ? 'S/RES/2026/001' : 'E/2026/INF/1'} (2026)}\n`;
    doc += `\\renewcommand{\\headrulewidth}{0.4pt}\n\n`;

    doc += `\\begin{document}\n\n`;
    
    const committeeName = committeeInfo?.name || String(committeeId || 'Comité');
    const article = committeeInfo?.article || 'El';

    // UN LOGO & COMMITTEE BOX
    doc += `\\noindent\n`;
    doc += `\\begin{minipage}[t]{0.15\\textwidth}\n`;
    doc += `  \\includegraphics[width=2.5cm]{un_logo_bw}\n`; 
    doc += `\\end{minipage}\n`;
    doc += `\\begin{minipage}[t]{0.5\\textwidth}\n`;
    doc += `  \\vspace{0.3cm}\n`;
    doc += `  {\\Large\\bfseries ${committeeName.toUpperCase()}}\n`;
    doc += `\\end{minipage}\n`;
    doc += `\\begin{minipage}[t]{0.35\\textwidth}\n`;
    doc += `  \\begin{flushright}\n`;
    doc += `    \\small Distr. general \\\\ \n`;
    doc += `    \\small ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}\n`;
    doc += `  \\end{flushright}\n`;
    doc += `\\end{minipage}\n\n`;

    doc += `\\hrule height 2pt \\vspace{1cm}\n\n`;

    // DOCUMENT TYPE SPECIFIC HEADERS
    if (isRes) {
        doc += `\\begin{center}\n`;
        doc += `  {\\large\\bfseries Resolución 2026/1}\n`;
        doc += `\\end{center}\n`;
        doc += `\\noindent \\textbf{Aprobada por ${article.toLowerCase() === 'el' ? 'el' : 'la'} ${committeeName} en su ${params.session} sesión, celebrada el ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}} \\\\ \n\n`;
        doc += `\\textit{${article} ${committeeName},}\n\n`;
    } else if (isDec) {
        doc += `\\noindent \\textbf{${params.session}} \\\\ \n`;
        doc += `\\noindent Tema ${params.topic || 'X'} del programa \\\\ \n`;
        doc += `\\noindent \\textbf{${params.topic || 'Declaración Ministerial de la serie de sesiones... '}} \\\\ \n\n`;
        doc += `\\begin{center}\n`;
        doc += `  {\\large\\bfseries DECLARACIÓN SOBRE ${params.topic || 'EL TÓPICO'}}\n`;
        doc += `\\end{center}\n\n`;
    }

    // Inject Content
    doc += html
      .replace(/<div[^>]*>/g, '').replace(/<\/div>/g, '\n') 
      .replace(/<h1[^>]*>(.*?)<\/h1>/g, '\\begin{center}\n  {\\Large\\bfseries $1}\n\\end{center}\n\\vspace{1em}\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/g, '\\section*{$1}\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/g, '\\subsection*{$1}\n')
      .replace(/<p[^>]*>(.*?)<\/p>/g, '$1\n\n')
      .replace(/<strong>(.*?)<\/strong>/g, '\\textbf{$1}')
      .replace(/<b>(.*?)<\/b>/g, '\\textbf{$1}')
      .replace(/<em>(.*?)<\/em>/g, '\\textit{$1}')
      .replace(/<i>(.*?)<\/i>/g, '\\textit{$1}')
      .replace(/<ul>([\s\S]*?)<\/ul>/g, '\\begin{itemize}\n$1\\end{itemize}')
      .replace(/<li>(.*?)<\/li>/g, '  \\item $1\n')
      .replace(/<br\s*\/?>/g, '\\\\ ')
      .replace(/<hr\s*\/?>/g, '\n\\vfill\\newpage\n')
      .replace(/<[^>]*>/g, '');

    doc += `\n\n\\end{document}`;
    return doc;
  };

  if (!isMounted || !editor) return null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#020617]">
      {/* TOOLBAR */}
      <div className="px-6 py-4 border-b border-white/10 bg-white/[0.03] flex items-center justify-between shrink-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
              <button 
                onClick={() => editor.chain().focus().toggleBold().run()} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all border ${editor.isActive('bold') ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                B
              </button>
              <button 
                onClick={() => editor.chain().focus().toggleItalic().run()} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm italic transition-all border ${editor.isActive('italic') ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                I
              </button>
              <button 
                onClick={() => editor.chain().focus().toggleUnderline().run()} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm underline transition-all border ${editor.isActive('underline') ? 'bg-cyan-500 text-black border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                U
              </button>
              
              <div className="w-px h-6 bg-white/10 mx-2" />
              
              <button 
                onClick={() => editor.chain().focus().toggleBulletList().run()} 
                className={`px-4 h-10 rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest transition-all border ${editor.isActive('bulletList') ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'}`}
              >
                List
              </button>
              <button 
                onClick={addImage} 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                title="Insertar Imagen"
              >
                🖼️
              </button>
              <button 
                onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-white/5 border border-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                title="Insertar Tabla"
              >
                📊
              </button>
          </div>

          <div className="flex items-center gap-6">
              <div className="flex items-center gap-1 bg-black/40 px-4 py-1.5 rounded-2xl border border-white/10 shadow-inner">
                  <button 
                    onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} 
                    className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-cyan-400 transition-colors text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="text-[11px] font-black text-white/80 w-14 text-center tabular-nums">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button 
                    onClick={() => setZoom(Math.min(2.0, zoom + 0.1))} 
                    className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-cyan-400 transition-colors text-lg font-bold"
                  >
                    +
                  </button>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-cyan-400 animate-pulse">Canvas v2.5</span>
                <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest">Hi-Fi Precision</span>
              </div>
          </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col h-full bg-[#020617]">
        {viewMode === 'edit' ? (
          <div className="flex-1 overflow-auto p-12 custom-scrollbar selection:bg-cyan-500/30">
            {/* PAPER SIMULATION - OFFICIAL UN STYLE (B&W) */}
            <div 
                className={`max-w-[210mm] mx-auto text-black min-h-[297mm] p-[25mm] shadow-[0_0_80px_rgba(0,0,0,0.8)] font-serif relative transition-all duration-300 origin-top ${params.docType === 'Proyecto de Resolución' ? 'resolution-numbered' : ''}`}
                style={{ 
                    transform: `scale(${zoom})`, 
                    marginBottom: `${(zoom - 1) * 350}mm`,
                    backgroundColor: 'white',
                    color: 'black',
                    display: 'block'
                }}
            >
                
                {/* STRICT UN HEADER FROM IMAGES */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10pt', fontFamily: 'serif', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700 }}>Naciones Unidas</span>
                    <span style={{ fontWeight: 700 }}>
                        {params.docType === 'Proyecto de Resolución' ? 'S/RES/2026/001' : 'E/2026/INF/1'} (2026)
                    </span>
                </div>
                <hr style={{ border: 'none', borderTop: '0.5px solid black', margin: '0 0 15px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
                    <div style={{ border: '1px solid black', padding: '5px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <img 
                          src="/images/ONU-black.jpg" 
                          style={{ width: '70px' }} 
                          alt="UN Logo"
                        />
                        <h1 style={{ fontSize: '18pt', fontWeight: 900, fontFamily: 'serif', margin: 0, textTransform: 'none' }}>
                            {String(committeeInfo?.name || committeeId || 'Comité')}
                        </h1>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '9pt', fontFamily: 'serif', color: '#000' }}>
                        <div style={{ fontWeight: 700 }}>Distr. general</div>
                        <div>{new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                    </div>
                </div>

                {/* THICK SEPARATOR LINE */}
                <hr style={{ border: 'none', borderTop: '3px solid black', marginBottom: '25px' }} />

                {/* SESSION / APPROVAL INFO (Generalizing from images) */}
                <div style={{ marginBottom: '30px' }} className="un-document-fixed-headers">
                    {params.docType === 'Proyecto de Resolución' ? (
                        <>
                            <div style={{ textAlign: 'center', fontSize: '14pt', fontWeight: 900, marginBottom: '15px' }}>
                                Resolución 2026/1 (2026)
                            </div>
                            <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.4 }}>
                                Aprobada por {((committeeId && COMMITTEES[committeeId as string]?.article) || 'El').toLowerCase() === 'el' ? 'el' : 'la'} {(committeeId && COMMITTEES[committeeId as string]?.name) || 'Asamblea General'} en su {params.session} sesión, celebrada el {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </div>
                            <div style={{ fontSize: '11pt', fontStyle: 'italic', marginTop: '20px' }}>
                                {committeeInfo?.article || 'El'} {committeeInfo?.name || 'Asamblea General'},
                            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.4 }}>
                            <div>{params.session}</div>
                            <div>Tema {params.topic ? 'X' : 'X'} del programa</div>
                            <div style={{ marginTop: '5px' }}>Serie de sesiones de alto nivel sobre el tema</div>
                            <div style={{ textTransform: 'uppercase', marginTop: '10px', textAlign: 'center', fontSize: '13pt' }}>
                                {params.topic || 'DECLARACIÓN MINISTERIAL'}
                            </div>
                        </div>
                    )}
                    {/* SEPARATOR LINE BEFORE BODY (Official Format) */}
                    <hr style={{ border: 'none', borderTop: '0.5px solid black', marginTop: '20px' }} />
                </div>

                {/* Editor Content with Paper Styling */}
                <div className="prose-paper-editor">
                    <EditorContent editor={editor} />
                </div>

                {/* Footer seal placeholder */}
                <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '0.5px solid #000', opacity: 0.5 }}>
                    <span style={{ fontSize: '7pt', fontFamily: 'sans-serif', fontStyle: 'italic', textTransform: 'uppercase' }}>Drafting Mode — Estándar Documental MUNify Co-Pilot</span>
                </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-[#020617]/90 p-12 font-mono text-sm leading-relaxed custom-scrollbar relative">
            <div className="absolute top-4 right-8 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] font-black uppercase text-purple-400 tracking-widest animate-pulse">
              LaTeX Engine Active
            </div>
            <pre className="max-w-3xl mx-auto whitespace-pre-wrap text-purple-300/80 selection:bg-purple-500/30">
              {toLaTeX()}
            </pre>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ProseMirror { outline: none; }
        .prose-paper-editor h1 { display: none; }
        .prose-paper-editor h2 { font-size: 14pt; font-weight: 700; color: black; margin-top: 25px; font-family: serif; text-transform: uppercase; }
        .prose-paper-editor h3 { font-size: 12pt; font-weight: 900; margin-top: 20px; color: black; font-family: serif; text-transform: uppercase; }
        .prose-paper-editor p { font-size: 11.5pt; line-height: 1.6; text-align: justify; margin-bottom: 12px; font-family: serif; color: black; position: relative; }
        
        /* Official Line Numbering for Resolutions */
        .resolution-numbered .prose-paper-editor {
          counter-reset: un-line;
        }

        /* Ensure fixed headers DO NOT increment the counter */
        .un-document-fixed-headers, 
        .un-document-fixed-headers div,
        .un-document-fixed-headers p {
            counter-increment: none !important;
        }
        
        .resolution-numbered .prose-paper-editor p,
        .resolution-numbered .prose-paper-editor li {
          position: relative;
          counter-increment: un-line;
        }
        
        .resolution-numbered .prose-paper-editor p::before,
        .resolution-numbered .prose-paper-editor li::before {
          content: counter(un-line);
          position: absolute;
          left: -35px;
          top: 0;
          font-size: 8pt;
          font-family: sans-serif;
          color: #ef4444; /* Intense Red */
          font-weight: 900;
          text-align: right;
          width: 25px;
          pointer-events: none;
          opacity: 1;
        }

        .prose-paper-editor ul { list-style-type: disc; margin-left: 20px; margin-bottom: 15px; }
        .prose-paper-editor li { margin-bottom: 5px; font-size: 11.5pt; font-family: serif; color: black; text-align: justify; }
        /* Tiptap Placeholder centering if needed */
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(0, 0, 0, 0.1);
          pointer-events: none;
          height: 0;
        }

        /* Collaboration Cursors - High Fidelity Styles */
        .collaboration-cursor__caret {
          position: relative;
          margin-left: -1px;
          margin-right: -1px;
          word-break: normal;
          pointer-events: none;
        }

        .collaboration-cursor__label {
          position: absolute;
          top: -1.4em;
          left: -1px;
          font-size: 10px;
          font-style: normal;
          font-weight: 900;
          line-height: normal;
          user-select: none;
          padding: 2px 8px;
          border-radius: 4px 4px 4px 0;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
      ` }} />
    </div>
  );
}
