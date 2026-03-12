'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image as TiptapImage } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extension-placeholder';

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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TiptapImage.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: 'El lienzo está listo. Empieza a redactar o usa la IA...',
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px]',
      },
    },
  });

  // Keep editor in sync with external content
  useEffect(() => {
    if (editor && content) {
      if (editor.getHTML() !== content) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  // Listen for AI content insertion events
  useEffect(() => {
    const handleInsert = (e: any) => {
      if (editor) {
        editor.chain().focus().insertContent(e.detail).run();
      }
    };
    window.addEventListener('insert-ai-content', handleInsert);
    return () => window.removeEventListener('insert-ai-content', handleInsert);
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
    
    const committeeName = (committeeId && COMMITTEES[committeeId as string]?.name) || String(committeeId || 'Comité');
    const article = (committeeId && COMMITTEES[committeeId as string]?.article) || 'El';

    // UN LOGO & COMMITTEE BOX
    doc += `\\noindent\n`;
    doc += `\\begin{minipage}[t]{0.15\\textwidth}\n`;
    doc += `  \\includegraphics[width=2.5cm]{un_logo_bw}\n`; // Placeholder for logo
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
;

  if (!editor) return null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1">
              <button onClick={() => editor.chain().focus().toggleBold().run()} className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs transition ${editor.isActive('bold') ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'hover:bg-white/5 text-white/40'}`}><b>B</b></button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs transition ${editor.isActive('italic') ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'hover:bg-white/5 text-white/40'}`}><i>I</i></button>
              <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs transition ${editor.isActive('underline') ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'hover:bg-white/5 text-white/40'}`}><u>U</u></button>
              <div className="w-px h-4 bg-white/10 mx-2" />
              <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`w-12 h-9 rounded-xl flex items-center justify-center text-[10px] font-black uppercase transition ${editor.isActive('bulletList') ? 'bg-cyan-500 text-black' : 'hover:bg-white/5 text-white/40'}`}>List</button>
              <button onClick={addImage} className="w-10 h-9 rounded-xl flex items-center justify-center text-xs hover:bg-white/5 text-white/40 transition">🖼️</button>
              <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="w-10 h-9 rounded-xl flex items-center justify-center text-xs hover:bg-white/5 text-white/40 transition">表格</button>
          </div>
          <div className="text-[8px] font-black uppercase tracking-[0.3em] text-cyan-400/40">Canvas v2.1</div>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col h-full">
        {viewMode === 'edit' ? (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#020617] selection:bg-cyan-500/30 h-full">
            {/* PAPER SIMULATION - OFFICIAL UN STYLE (B&W) */}
            <div className={`max-w-[210mm] mx-auto bg-white text-black min-h-[297mm] p-[25mm] shadow-[0_0_100px_rgba(0,0,0,0.5)] font-serif relative transition-all duration-700 ${params.docType === 'Proyecto de Resolución' ? 'resolution-numbered' : ''}`}>
                
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
                            {String((committeeId && COMMITTEES[committeeId as string]?.name) || committeeId || 'Comité')}
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
                                {(committeeId && COMMITTEES[committeeId as string]?.article) || 'El'} {(committeeId && COMMITTEES[committeeId as string]?.name) || 'Asamblea General'},
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
            <div className="absolute top-4 right-8 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-[8px] font-black uppercase text-purple-400 tracking-widest animate-pulse">
              LaTeX Engine Active
            </div>
            <pre className="max-w-3xl mx-auto whitespace-pre-wrap text-purple-300/80 selection:bg-purple-500/30">
              {toLaTeX()}
            </pre>
          </div>
        )}
      </div>

      <style jsx global>{`
        .ProseMirror { outline: none; }
        .prose-paper-editor h1 { display: none; } /* Hidden inside editor as header handles it */
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
      `}</style>
    </div>
  );
}
