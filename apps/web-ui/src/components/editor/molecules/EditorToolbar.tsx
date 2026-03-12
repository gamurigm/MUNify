import React from 'react';
import { Editor } from '@tiptap/react';
import { ToolbarButton, ToolbarDivider } from '../atoms/ToolbarButton';

interface EditorToolbarProps {
  editor: Editor;
  showLineNumbers: boolean;
  setShowLineNumbers: (show: boolean) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, showLineNumbers, setShowLineNumbers }) => {
  return (
    <div className="editor-toolbar">
      {/* Text Style */}
      <select
        className="toolbar-select"
        value={
          editor.isActive('heading', { level: 1 }) ? '1' :
          editor.isActive('heading', { level: 2 }) ? '2' :
          editor.isActive('heading', { level: 3 }) ? '3' : '0'
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === '0') editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: parseInt(v) as 1|2|3 }).run();
        }}
      >
        <option value="0">Párrafo</option>
        <option value="1">Título 1</option>
        <option value="2">Título 2</option>
        <option value="3">Título 3</option>
      </select>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita (Ctrl+B)">
        <b>N</b>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva (Ctrl+I)">
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado (Ctrl+U)">
        <u>S</u>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
        <s>T</s>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight({ color: '#ffe066' }).run()} active={editor.isActive('highlight')} title="Resaltar">
        <span style={{ background: '#ffe066', color: '#000', padding: '0 3px', borderRadius: 2 }}>R</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subíndice">
        X<sub>₂</sub>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superíndice">
        X<sup>²</sup>
      </ToolbarButton>

      <ToolbarDivider />

      <div className="toolbar-color-wrapper" title="Color de texto">
        <span className="toolbar-color-label">A</span>
        <input
          type="color"
          className="toolbar-color-input"
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          defaultValue="#ffffff"
        />
      </div>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Alinear izquierda">
        ≡
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Centrar">
        ≡
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Alinear derecha">
        ≡
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificar">
        ☰
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista con viñetas">
        •≡
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
        1.
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Cita">
        ❝
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea horizontal">
        ―
      </ToolbarButton>

      <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insertar tabla 3x3">
        ⊞
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer (Ctrl+Z)">
        ↩
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer (Ctrl+Y)">
        ↪
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => setShowLineNumbers(!showLineNumbers)} active={showLineNumbers} title="Numeración de líneas">
        #
      </ToolbarButton>
    </div>
  );
};
