import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

export const useCollaborativeEditor = (
  documentId: string,
  initialContent: string,
  showLineNumbers: boolean
) => {
  const [status, setStatus] = useState<string>('connecting...');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'pending'>('saved');

  // Yjs Setup
  const { ydoc, provider } = useMemo(() => {
    const doc = new Y.Doc();
    const wsProvider = new WebsocketProvider('ws://localhost:1234', `munify-doc-${documentId}`, doc);
    return { ydoc: doc, provider: wsProvider };
  }, [documentId]);

  useEffect(() => {
    provider.on('status', ({ status }: { status: string }) => setStatus(status));
    
    provider.on('sync', (isSynced: boolean) => {
      if (isSynced && ydoc.getXmlFragment('prosemirror').length === 0 && initialContent) {
        // Initial integration handler
      }
    });

    return () => { provider.destroy(); ydoc.destroy(); };
  }, [provider, ydoc, initialContent]);

  // Auto-Save
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveToBackend = useCallback(async (content: string) => {
    setSaveStatus('saving');
    try {
      const token = localStorage.getItem('munify_token');
      const res = await fetch(`http://localhost:8080/api/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ content, changeSummary: 'Auto-save' })
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
    } catch { setSaveStatus('error'); }
  }, [documentId]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Empieza a escribir tu documento MUN aquí...' }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      Subscript,
      Superscript,
      Image.configure({ inline: true, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    onUpdate: ({ editor }) => {
      const text = editor.getText();
      setWordCount(text.split(/\s+/).filter(Boolean).length);
      setCharCount(text.length);
      setSaveStatus('pending');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => saveToBackend(editor.getHTML()), 3000);
    },
    editorProps: {
      attributes: {
        class: showLineNumbers ? 'editor-content editor-line-numbers' : 'editor-content',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setOptions({
        editorProps: {
          attributes: {
            class: showLineNumbers ? 'editor-content editor-line-numbers' : 'editor-content',
          },
        },
      });
    }
  }, [showLineNumbers, editor]);

  return { editor, status, saveStatus, wordCount, charCount };
};
