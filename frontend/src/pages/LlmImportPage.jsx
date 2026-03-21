import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

export default function LlmImportPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [modules, setModules] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [messages, setMessages] = useState([]);
  const [docText, setDocText] = useState('');
  const [docFilename, setDocFilename] = useState('');
  const [extractedReqs, setExtractedReqs] = useState([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importSuccess, setImportSuccess] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    api.projects.list().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) { setModules([]); setModuleId(''); return; }
    api.projects.get(projectId)
      .then(p => { setModules(p.modules || []); setModuleId(''); })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const { text, filename } = await api.llm.upload(file);
      setDocText(text);
      setDocFilename(filename);
      setMessages([]);
      setExtractedReqs([]);
      setImportSuccess(null);
      // Automatically send the document to the LLM
      const firstMsg = { role: 'user', content: `Please analyse this document and extract all software requirements from it:\n\n${text}` };
      const newMessages = [firstMsg];
      setMessages([{ role: 'user', content: `[Uploaded: ${filename}] Analysing document...` }]);
      setSending(true);
      const { reply, requirements } = await api.llm.chat(newMessages);
      setMessages([
        { role: 'user', content: `[Uploaded: ${filename}]` },
        { role: 'assistant', content: reply },
      ]);
      if (requirements) setExtractedReqs(requirements);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    setError('');
    const userMsg = { role: 'user', content: input.trim() };
    setInput('');

    // Build conversation history for context (use raw messages including doc text)
    const history = buildHistory();
    const newHistory = [...history, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const { reply, requirements } = await api.llm.chat(newHistory);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (requirements) setExtractedReqs(requirements);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function buildHistory() {
    // Reconstruct messages with actual document text for the first user message
    return messages.map((m, i) => {
      if (i === 0 && m.role === 'user' && docText) {
        return { role: 'user', content: `Please analyse this document and extract all software requirements from it:\n\n${docText}` };
      }
      return { role: m.role, content: m.content };
    });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function updateReq(idx, field, value) {
    setExtractedReqs(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function removeReq(idx) {
    setExtractedReqs(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleImport() {
    if (!moduleId) { setError('Please select a module before importing'); return; }
    if (extractedReqs.length === 0) { setError('No requirements to import'); return; }
    setError('');
    setImporting(true);
    try {
      const result = await api.llm.import(Number(moduleId), extractedReqs);
      setImportSuccess({ count: result.imported, moduleId });
      setExtractedReqs([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const hasDoc = docText.length > 0;
  const canSend = hasDoc && input.trim().length > 0 && !sending;

  return (
    <Layout>
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">AI Requirements Import</h1>
        <p style={{ color: '#64748b', margin: 0 }}>
          Upload a Word or PDF document and chat with the AI to extract and refine requirements.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* LEFT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Project/Module selectors */}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Target Module</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: '#475569' }}>Project</label>
              <select
                className="input"
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Select project…</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <label style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>Module</label>
              <select
                className="input"
                value={moduleId}
                onChange={e => setModuleId(e.target.value)}
                style={{ width: '100%' }}
                disabled={!projectId}
              >
                <option value="">Select module…</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Upload */}
          <div className="card" style={{ padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 600 }}>Upload Document</h3>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 0.75rem' }}>
              Supported: .docx, .doc, .pdf (max 50 MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.doc,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
              id="doc-upload"
            />
            <label htmlFor="doc-upload">
              <div
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: uploading ? '#f8fafc' : 'white',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { if (!uploading) e.currentTarget.style.borderColor = '#6366f1'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; }}
              >
                {uploading ? (
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Parsing document…</span>
                ) : docFilename ? (
                  <>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📄</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', wordBreak: 'break-all' }}>{docFilename}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>Click to replace</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⬆️</div>
                    <div style={{ fontSize: '0.82rem', color: '#475569' }}>Click to upload</div>
                  </>
                )}
              </div>
            </label>
          </div>

          {/* Import success */}
          {importSuccess && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem', color: '#15803d', fontWeight: 600, fontSize: '0.85rem' }}>
                ✓ Imported {importSuccess.count} requirement{importSuccess.count !== 1 ? 's' : ''}
              </p>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                onClick={() => navigate(`/modules/${importSuccess.moduleId}`)}
              >
                View module →
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Chat window */}
          <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '450px' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>
              Chat
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '350px', maxHeight: '450px' }}>
              {messages.length === 0 && !sending && (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', marginTop: '2rem' }}>
                  {hasDoc ? 'Document loaded. Chat is ready.' : 'Upload a document to start the conversation.'}
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    background: msg.role === 'user' ? '#6366f1' : '#f1f5f9',
                    color: msg.role === 'user' ? 'white' : '#1e293b',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '0.6rem 0.9rem',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.content}
                </div>
              ))}
              {sending && (
                <div style={{
                  alignSelf: 'flex-start',
                  background: '#f1f5f9',
                  borderRadius: '12px 12px 12px 2px',
                  padding: '0.6rem 0.9rem',
                  fontSize: '0.85rem',
                  color: '#64748b',
                }}>
                  Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasDoc ? 'Ask about the requirements, request changes, or say "import these"…' : 'Upload a document first…'}
                disabled={!hasDoc || sending}
                rows={2}
                style={{
                  flex: 1,
                  resize: 'none',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={!canSend}
                style={{ alignSelf: 'flex-end', padding: '0.5rem 1rem' }}
              >
                Send
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.75rem 1rem', color: '#dc2626', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Extracted requirements table */}
          {extractedReqs.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  Extracted Requirements ({extractedReqs.length})
                </span>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={importing || !moduleId}
                  title={!moduleId ? 'Select a module first' : ''}
                >
                  {importing ? 'Importing…' : `Import ${extractedReqs.length} requirement${extractedReqs.length !== 1 ? 's' : ''}`}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>#</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Title</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Priority</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>Description</th>
                      <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {extractedReqs.map((req, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <input
                            value={req.title}
                            onChange={e => updateReq(idx, 'title', e.target.value)}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.4rem', fontSize: '0.82rem', fontFamily: 'inherit' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <select
                            value={req.priority}
                            onChange={e => updateReq(idx, 'priority', e.target.value)}
                            style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.4rem', fontSize: '0.82rem', fontFamily: 'inherit' }}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <select
                            value={req.status}
                            onChange={e => updateReq(idx, 'status', e.target.value)}
                            style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.4rem', fontSize: '0.82rem', fontFamily: 'inherit' }}
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="approved">Approved</option>
                            <option value="deprecated">Deprecated</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <textarea
                            value={req.description}
                            onChange={e => updateReq(idx, 'description', e.target.value)}
                            rows={2}
                            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '0.25rem 0.4rem', fontSize: '0.82rem', fontFamily: 'inherit', resize: 'vertical' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <button
                            onClick={() => removeReq(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', padding: '0.2rem' }}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </Layout>
  );
}
