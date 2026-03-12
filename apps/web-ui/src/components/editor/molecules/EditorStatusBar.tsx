import React from 'react';

interface EditorStatusBarProps {
  status: string;
  saveStatus: 'saved' | 'saving' | 'error' | 'pending';
  wordCount: number;
  charCount: number;
}

export const EditorStatusBar: React.FC<EditorStatusBarProps> = ({ status, saveStatus, wordCount, charCount }) => {
  return (
    <div className="editor-status-bar">
      <div className="status-left">
        <div className={`status-dot ${status === 'connected' ? 'status-dot-ok' : 'status-dot-err'}`} />
        <span className="status-text">{status === 'connected' ? 'Conectado' : status}</span>
        <span className="status-sep">|</span>
        {saveStatus === 'saved' && <span className="save-ok">✓ Guardado</span>}
        {saveStatus === 'pending' && <span className="save-pending">Editando...</span>}
        {saveStatus === 'saving' && (
          <span className="save-saving"><span className="spinner" /> Guardando</span>
        )}
        {saveStatus === 'error' && <span className="save-err">⚠ Error al guardar</span>}
      </div>
      <div className="status-right">
        <span>{wordCount} palabras</span>
        <span className="status-sep">|</span>
        <span>{charCount} caracteres</span>
      </div>
    </div>
  );
};
