import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { api } from '../api';

// Hook for mention suggestion state management
function useMentionSuggestion() {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const commandRef = useRef(null);
  const suggestionsRef = useRef([]);

  // Keep ref in sync for use inside keydown handler
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);

  const suggestion = {
    char: '@',
    items: async ({ query }) => {
      try {
        const reqs = await api.requirements.list({ search: query });
        return (reqs || []).slice(0, 10).map(r => ({ id: String(r.id), req_id: r.req_id, title: r.title, label: r.req_id }));
      } catch { return []; }
    },
    render: () => ({
      onStart: (props) => {
        setSuggestions(props.items);
        setShowSuggestions(true);
        setSelectedIdx(0);
        commandRef.current = props.command;
        if (props.clientRect) {
          const rect = props.clientRect();
          if (rect) setSuggestionPos({ top: rect.bottom + 4, left: rect.left });
        }
      },
      onUpdate: (props) => {
        setSuggestions(props.items);
        setSelectedIdx(0);
        commandRef.current = props.command;
        if (props.clientRect) {
          const rect = props.clientRect();
          if (rect) setSuggestionPos({ top: rect.bottom + 4, left: rect.left });
        }
      },
      onKeyDown: ({ event }) => {
        const items = suggestionsRef.current;
        if (event.key === 'Escape') { setShowSuggestions(false); return true; }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIdx(i => (i + items.length - 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIdx(i => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          setSelectedIdx(i => {
            if (items[i] && commandRef.current) commandRef.current(items[i]);
            return i;
          });
          return true;
        }
        return false;
      },
      onExit: () => { setShowSuggestions(false); setSuggestions([]); },
    }),
  };

  const SuggestionDropdown = showSuggestions ? (
    <div className="mention-dropdown" style={{ position: 'fixed', top: suggestionPos.top, left: suggestionPos.left, zIndex: 9999 }}>
      {suggestions.length === 0 ? (
        <div className="mention-item empty">No requirements found</div>
      ) : (
        suggestions.map((item, i) => (
          <button
            key={item.id}
            className={`mention-item ${i === selectedIdx ? 'selected' : ''}`}
            onClick={() => { if (commandRef.current) commandRef.current(item); }}
          >
            <span className="mention-item-id">{item.req_id}</span>
            <span className="mention-item-title">{item.title}</span>
          </button>
        ))
      )}
    </div>
  ) : null;

  return { suggestion, SuggestionDropdown };
}

// Custom floating bubble menu on text selection
function FloatingBubbleMenu({ editor, onCreateRequirement }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);

  useEffect(() => {
    if (!editor) return;

    function update() {
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setVisible(false);
        return;
      }
      // Get bounding rect of selection
      const coords = editor.view.coordsAtPos(from);
      const endCoords = editor.view.coordsAtPos(to);
      const top = coords.top - 40;
      const left = (coords.left + endCoords.left) / 2;
      setPos({ top, left });
      setVisible(true);
    }

    editor.on('selectionUpdate', update);
    editor.on('blur', () => setTimeout(() => setVisible(false), 200));
    return () => {
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  if (!visible || !editor) return null;

  return (
    <div className="bubble-menu" ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 50 }}>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className={editor.isActive('bold') ? 'active' : ''}><b>B</b></button>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className={editor.isActive('italic') ? 'active' : ''}><i>I</i></button>
      <button onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }} className={editor.isActive('strike') ? 'active' : ''}><s>S</s></button>
      {onCreateRequirement && (
        <>
          <div className="toolbar-separator" />
          <button
            className="btn-create-req"
            onMouseDown={e => {
              e.preventDefault();
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, ' ');
              if (selectedText.trim()) {
                onCreateRequirement(selectedText.trim(), (req) => {
                  editor.chain().focus()
                    .deleteRange({ from, to })
                    .insertContent({
                      type: 'mention',
                      attrs: { id: String(req.id), label: req.req_id },
                    })
                    .run();
                });
              }
            }}
          >
            + Req
          </button>
        </>
      )}
    </div>
  );
}

export default function WikiEditor({ content, onUpdate, readOnly, onCreateRequirement, placeholder }) {
  const navigate = useNavigate();
  const { suggestion, SuggestionDropdown } = useMentionSuggestion();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'wiki-link' },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing... Use @ to reference requirements',
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Mention.configure({
        HTMLAttributes: { class: 'req-mention' },
        suggestion,
        renderLabel: ({ node }) => node.attrs.label || node.attrs.id,
      }),
    ],
    content: parseContent(content),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onUpdate) onUpdate(JSON.stringify(editor.getJSON()));
    },
  });

  // Update editor content when prop changes externally
  const prevContent = useRef(content);
  useEffect(() => {
    if (editor && content !== prevContent.current) {
      prevContent.current = content;
      const parsed = parseContent(content);
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(parsed)) {
        editor.commands.setContent(parsed);
      }
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [readOnly, editor]);

  // Handle click on requirement mentions to navigate
  useEffect(() => {
    if (!editor) return;
    const el = editor.view.dom;
    function handleClick(e) {
      const mention = e.target.closest('[data-type="mention"]');
      if (mention) {
        const id = mention.getAttribute('data-id');
        if (id) navigate(`/requirements/${id}`);
      }
    }
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [editor, navigate]);

  if (!editor) return null;

  return (
    <div className="wiki-editor">
      {!readOnly && (
        <div className="wiki-toolbar">
          <div className="toolbar-group">
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''} title="Bold"><b>B</b></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''} title="Italic"><i>I</i></button>
            <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'active' : ''} title="Strikethrough"><s>S</s></button>
            <button onClick={() => editor.chain().focus().toggleCode().run()} className={editor.isActive('code') ? 'active' : ''} title="Inline Code">&lt;/&gt;</button>
          </div>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'active' : ''} title="Heading 1">H1</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'active' : ''} title="Heading 2">H2</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'active' : ''} title="Heading 3">H3</button>
          </div>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''} title="Bullet List">&#8226; List</button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'active' : ''} title="Ordered List">1. List</button>
          </div>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'active' : ''} title="Blockquote">&ldquo;</button>
            <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={editor.isActive('codeBlock') ? 'active' : ''} title="Code Block">{'{ }'}</button>
            <button onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">&mdash;</button>
          </div>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert Table">Table</button>
          </div>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">&#x21B6;</button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">&#x21B7;</button>
          </div>
        </div>
      )}

      {!readOnly && <FloatingBubbleMenu editor={editor} onCreateRequirement={onCreateRequirement} />}

      <EditorContent editor={editor} className="wiki-editor-content" />
      {SuggestionDropdown}
    </div>
  );
}

function parseContent(content) {
  if (!content || content === '{}') return '';
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.type === 'doc') return parsed;
      return '';
    } catch {
      return content;
    }
  }
  return content;
}
