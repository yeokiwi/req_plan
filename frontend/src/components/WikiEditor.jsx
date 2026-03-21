import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import { RichTextProvider } from 'reactjs-tiptap-editor';
import 'reactjs-tiptap-editor/style.css';

// Base extensions
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import Paragraph from '@tiptap/extension-paragraph';
import HardBreak from '@tiptap/extension-hard-break';
import { TextStyle } from '@tiptap/extension-text-style';
import { ListItem } from '@tiptap/extension-list-item';
import { Dropcursor, Gapcursor, Placeholder, TrailingNode } from '@tiptap/extensions';

// Feature extensions from reactjs-tiptap-editor
import { Bold, RichTextBold } from 'reactjs-tiptap-editor/bold';
import { Italic, RichTextItalic } from 'reactjs-tiptap-editor/italic';
import { TextUnderline, RichTextUnderline } from 'reactjs-tiptap-editor/textunderline';
import { Strike, RichTextStrike } from 'reactjs-tiptap-editor/strike';
import { Code, RichTextCode } from 'reactjs-tiptap-editor/code';
import { Heading, RichTextHeading } from 'reactjs-tiptap-editor/heading';
import { BulletList, RichTextBulletList } from 'reactjs-tiptap-editor/bulletlist';
import { OrderedList, RichTextOrderedList } from 'reactjs-tiptap-editor/orderedlist';
import { Blockquote, RichTextBlockquote } from 'reactjs-tiptap-editor/blockquote';
import { HorizontalRule, RichTextHorizontalRule } from 'reactjs-tiptap-editor/horizontalrule';
import { CodeBlock, RichTextCodeBlock } from 'reactjs-tiptap-editor/codeblock';
import { Table, RichTextTable } from 'reactjs-tiptap-editor/table';
import { Link, RichTextLink } from 'reactjs-tiptap-editor/link';
import { History, RichTextUndo, RichTextRedo } from 'reactjs-tiptap-editor/history';
import { Mention } from 'reactjs-tiptap-editor/mention';

// Bubble menus
import { RichTextBubbleText, RichTextBubbleLink, RichTextBubbleTable } from 'reactjs-tiptap-editor/bubble';

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

// Custom floating bubble menu for "+ Req" creation
function FloatingReqMenu({ editor, onCreateRequirement }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!editor) return;

    function update() {
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setVisible(false);
        return;
      }
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

  if (!visible || !editor || !onCreateRequirement) return null;

  return (
    <div className="bubble-menu floating-req-menu" style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 50 }}>
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
    </div>
  );
}

export default function WikiEditor({ content, onUpdate, readOnly, onCreateRequirement, placeholder }) {
  const navigate = useNavigate();
  const { suggestion, SuggestionDropdown } = useMentionSuggestion();

  const extensions = [
    // Base extensions
    Document,
    Text,
    Paragraph,
    Dropcursor,
    Gapcursor,
    HardBreak,
    TextStyle,
    ListItem,
    TrailingNode,
    Placeholder.configure({
      placeholder: placeholder || 'Start writing... Use @ to reference requirements',
    }),

    // Formatting
    Bold,
    Italic,
    TextUnderline,
    Strike,
    Code,
    Heading.configure({ levels: [1, 2, 3] }),

    // Lists
    BulletList,
    OrderedList,

    // Block
    Blockquote,
    HorizontalRule,
    CodeBlock,

    // Table
    Table.configure({ resizable: false }),

    // Link
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { class: 'wiki-link' },
    }),

    // History
    History,

    // Mention (requirement references)
    Mention.configure({
      HTMLAttributes: { class: 'req-mention' },
      suggestion,
      renderLabel: ({ node }) => node.attrs.label || node.attrs.id,
    }),
  ];

  const editor = useEditor({
    extensions,
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
    <RichTextProvider editor={editor}>
      <div className="wiki-editor">
        {!readOnly && (
          <div className="wiki-toolbar">
            <div className="toolbar-group">
              <RichTextBold />
              <RichTextItalic />
              <RichTextUnderline />
              <RichTextStrike />
              <RichTextCode />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
              <RichTextHeading />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
              <RichTextBulletList />
              <RichTextOrderedList />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
              <RichTextBlockquote />
              <RichTextCodeBlock />
              <RichTextHorizontalRule />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
              <RichTextTable />
              <RichTextLink />
            </div>
            <div className="toolbar-separator" />
            <div className="toolbar-group">
              <RichTextUndo />
              <RichTextRedo />
            </div>
          </div>
        )}

        <EditorContent editor={editor} className="wiki-editor-content" />

        {!readOnly && (
          <>
            <RichTextBubbleText />
            <RichTextBubbleLink />
            <RichTextBubbleTable />
            <FloatingReqMenu editor={editor} onCreateRequirement={onCreateRequirement} />
          </>
        )}

        {SuggestionDropdown}
      </div>
    </RichTextProvider>
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
