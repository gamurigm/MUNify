import React from 'react';

export const EditorStyles = () => (
  <style jsx global>{`
    /* ── Wrapper ── */
    .editor-wrapper {
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      overflow: hidden;
      background: rgba(4, 13, 33, 0.7);
      backdrop-filter: blur(12px);
    }

    /* ── Status Bar ── */
    .editor-status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 16px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      font-size: 11px;
      color: rgba(255,255,255,0.4);
    }
    .status-left, .status-right { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; }
    .status-dot-ok { background: #00f5ff; box-shadow: 0 0 8px #00f5ff; }
    .status-dot-err { background: #ff4444; }
    .status-text { font-weight: 500; }
    .status-sep { color: rgba(255,255,255,0.15); }
    .save-ok { color: rgba(255,255,255,0.35); }
    .save-pending { color: rgba(255,255,255,0.35); font-style: italic; }
    .save-saving { color: #00f5ff; display: flex; align-items: center; gap: 4px; }
    .save-err { color: #ff5555; }
    .spinner {
      display: inline-block; width: 10px; height: 10px;
      border: 2px solid #00f5ff; border-top-color: transparent;
      border-radius: 50%; animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Toolbar ── */
    .editor-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px;
      padding: 6px 10px;
      background: rgba(255,255,255,0.04);
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .toolbar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 30px;
      padding: 0 6px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: rgba(255,255,255,0.6);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .toolbar-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .toolbar-btn-active { background: rgba(0, 245, 255, 0.15); color: #00f5ff; }
    .toolbar-divider {
      width: 1px; height: 20px;
      background: rgba(255,255,255,0.1);
      margin: 0 4px;
    }
    .toolbar-select {
      height: 30px;
      padding: 0 8px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      cursor: pointer;
      outline: none;
    }
    .toolbar-select option { background: #0a1628; color: #fff; }
    .toolbar-color-wrapper {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px; height: 30px;
      border-radius: 6px;
      cursor: pointer;
    }
    .toolbar-color-wrapper:hover { background: rgba(255,255,255,0.1); }
    .toolbar-color-label {
      font-size: 14px; font-weight: 700;
      color: rgba(255,255,255,0.7);
      pointer-events: none;
      text-decoration: underline;
      text-decoration-color: #ff5cf5;
      text-decoration-thickness: 3px;
      text-underline-offset: 2px;
    }
    .toolbar-color-input {
      position: absolute; inset: 0;
      opacity: 0; cursor: pointer;
      width: 100%; height: 100%;
    }

    /* ── Bubble Menu ── */
    .bubble-menu {
      display: flex;
      gap: 2px;
      background: rgba(10, 22, 40, 0.95);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      padding: 4px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .bubble-menu button {
      width: 28px; height: 28px;
      border: none; border-radius: 4px;
      background: transparent;
      color: rgba(255,255,255,0.7);
      font-size: 12px; font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .bubble-menu button:hover { background: rgba(255,255,255,0.1); }
    .bubble-menu .bm-active { background: rgba(0,245,255,0.2); color: #00f5ff; }

    /* ── Editor Body ── */
    .editor-body {
      padding: 32px 48px;
      min-height: 600px;
      max-height: 75vh;
      overflow-y: auto;
    }
    .editor-body::-webkit-scrollbar { width: 6px; }
    .editor-body::-webkit-scrollbar-track { background: transparent; }
    .editor-body::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.15);
      border-radius: 3px;
    }

    /* ── Editor Content Styling ── */
    .editor-content {
      outline: none;
      color: rgba(255,255,255,0.88);
      font-family: 'Inter', 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.75;
      caret-color: #00f5ff;
    }
    .editor-content p { margin: 0.5em 0; }
    .editor-content h1 {
      font-size: 28px; font-weight: 800;
      color: #fff;
      margin: 1.2em 0 0.5em;
      border-bottom: 2px solid rgba(0,245,255,0.2);
      padding-bottom: 8px;
    }
    .editor-content h2 {
      font-size: 22px; font-weight: 700;
      color: rgba(255,255,255,0.95);
      margin: 1em 0 0.4em;
    }
    .editor-content h3 {
      font-size: 18px; font-weight: 600;
      color: rgba(255,255,255,0.9);
      margin: 0.8em 0 0.3em;
    }
    .editor-content ul, .editor-content ol {
      padding-left: 24px;
      margin: 0.5em 0;
    }
    .editor-content li { margin: 0.2em 0; }
    .editor-content blockquote {
      border-left: 3px solid rgba(0,245,255,0.4);
      padding: 8px 16px;
      margin: 0.8em 0;
      background: rgba(0,245,255,0.04);
      border-radius: 0 8px 8px 0;
      color: rgba(255,255,255,0.7);
      font-style: italic;
    }
    .editor-content hr {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.12);
      margin: 1.5em 0;
    }
    .editor-content mark {
      background: #ffe066;
      color: #000;
      border-radius: 2px;
      padding: 1px 3px;
    }
    .editor-content a { color: #00f5ff; text-decoration: underline; }
    .editor-content img {
      max-width: 100%;
      border-radius: 8px;
      margin: 8px 0;
    }

    /* ── Tables ── */
    .editor-content table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
      border-radius: 8px;
      overflow: hidden;
    }
    .editor-content th, .editor-content td {
      border: 1px solid rgba(255,255,255,0.12);
      padding: 8px 12px;
      text-align: left;
      min-width: 80px;
    }
    .editor-content th {
      background: rgba(0,245,255,0.08);
      font-weight: 600;
      color: #00f5ff;
    }
    .editor-content td { background: rgba(255,255,255,0.02); }
    .editor-content tr:hover td { background: rgba(255,255,255,0.04); }

    /* ── Line Numbers ── */
    .editor-line-numbers .ProseMirror > * {
      position: relative;
      counter-increment: editor-line;
      padding-left: 48px;
    }
    .editor-line-numbers {
      counter-reset: editor-line;
    }
    .editor-line-numbers .ProseMirror > *::before {
      content: counter(editor-line);
      position: absolute;
      left: 0;
      top: 0;
      width: 36px;
      text-align: right;
      color: rgba(255,255,255,0.18);
      font-size: 12px;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      line-height: inherit;
      pointer-events: none;
      user-select: none;
    }
    .editor-line-numbers .ProseMirror {
      border-left: 1px solid rgba(255,255,255,0.06);
    }

    /* ── Placeholder ── */
    .tiptap p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      float: left;
      color: rgba(255,255,255,0.2);
      pointer-events: none;
      height: 0;
      font-style: italic;
    }

    /* ── Cursor Presence ── */
    .collaboration-cursor__caret {
      border-left: 2px solid;
      margin-left: -1px;
      pointer-events: none;
      position: relative;
      word-break: normal;
    }
    .collaboration-cursor__label {
      position: absolute;
      top: -1.6em;
      left: -1px;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 4px 4px 4px 0;
      white-space: nowrap;
      user-select: none;
      color: #000;
    }
    /* Selected table cell */
    .selectedCell::after {
      background: rgba(0, 245, 255, 0.1);
      content: "";
      left: 0; right: 0; top: 0; bottom: 0;
      pointer-events: none;
      position: absolute;
      z-index: 2;
    }
  `}</style>
);
