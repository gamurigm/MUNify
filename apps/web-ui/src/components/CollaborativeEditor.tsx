'use client';

import React, { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { useCollaborativeEditor } from './editor/hooks/useCollaborativeEditor';
import { EditorStatusBar } from './editor/molecules/EditorStatusBar';
import { EditorToolbar } from './editor/molecules/EditorToolbar';
import { EditorStyles } from './editor/styles/EditorStyles';

interface CollaborativeEditorProps {
  documentId: string;
  initialContent: string;
  username: string;
  color?: string;
}

export default function CollaborativeEditor({ documentId, initialContent, username, color }: CollaborativeEditorProps) {
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  
  const { editor, status, saveStatus, wordCount, charCount } = useCollaborativeEditor(
    documentId,
    initialContent,
    showLineNumbers
  );

  if (!editor) return null;

  return (
    <div className="editor-wrapper">
      <EditorStatusBar 
        status={status} 
        saveStatus={saveStatus} 
        wordCount={wordCount} 
        charCount={charCount} 
      />

      <EditorToolbar 
        editor={editor} 
        showLineNumbers={showLineNumbers} 
        setShowLineNumbers={setShowLineNumbers} 
      />

      <div className="editor-body">
        <EditorContent editor={editor} />
      </div>

      <EditorStyles />
    </div>
  );
}
