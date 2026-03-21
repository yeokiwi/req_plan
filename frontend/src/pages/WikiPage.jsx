import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import WikiEditor from '../components/WikiEditor';
import CreateRequirementModal from '../components/CreateRequirementModal';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

function buildTree(pages) {
  const map = {};
  const roots = [];
  pages.forEach(p => { map[p.id] = { ...p, children: [] }; });
  pages.forEach(p => {
    if (p.parent_page_id && map[p.parent_page_id]) {
      map[p.parent_page_id].children.push(map[p.id]);
    } else {
      roots.push(map[p.id]);
    }
  });
  return roots;
}

function TreeNode({ node, selectedId, onSelect, onAddSubPage, onDelete, canEdit, depth = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="tree-node">
      <div
        className={`tree-item ${node.id === selectedId ? 'selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <span className="tree-toggle" onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}>
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="tree-toggle" style={{ visibility: 'hidden' }}>▸</span>
        )}
        <span className="tree-label">{node.title}</span>
        {canEdit && (
          <span className="tree-actions" onClick={e => e.stopPropagation()}>
            <button className="tree-action-btn" onClick={() => onAddSubPage(node.id)} title="Add sub-page">+</button>
            <button className="tree-action-btn danger" onClick={() => onDelete(node.id)} title="Delete page">&times;</button>
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddSubPage={onAddSubPage}
              onDelete={onDelete}
              canEdit={canEdit}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WikiPage() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [tree, setTree] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [showNewPage, setShowNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageParentId, setNewPageParentId] = useState(null);
  const [showCreateReq, setShowCreateReq] = useState(false);
  const [createReqTitle, setCreateReqTitle] = useState('');
  const [createReqCallback, setCreateReqCallback] = useState(null);

  const saveTimer = useRef(null);

  useEffect(() => {
    api.projects.list().then(list => {
      setProjects(list);
      if (list.length > 0 && !selectedProject) setSelectedProject(String(list[0].id));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    loadTree();
  }, [selectedProject]);

  function loadTree() {
    if (!selectedProject) return;
    api.wiki.getTree(selectedProject).then(pages => {
      setTree(buildTree(pages));
      // Auto-select first page or the pageId from URL
      if (pageId) {
        loadPage(pageId);
      } else if (pages.length > 0 && !selectedPage) {
        loadPage(pages[0].id);
      }
    }).catch(console.error);
  }

  function loadPage(id) {
    api.wiki.get(id).then(page => {
      setSelectedPage(page);
      setSaveStatus('');
    }).catch(console.error);
  }

  function handleSelectPage(id) {
    if (selectedPage && saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    loadPage(id);
    navigate(`/wiki/${id}`, { replace: true });
  }

  const handleEditorUpdate = useCallback((content) => {
    if (!selectedPage) return;
    setSaveStatus('Unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaveStatus('Saving...');
        await api.wiki.update(selectedPage.id, { content });
        setSaveStatus('Saved');
      } catch {
        setSaveStatus('Save failed');
      }
    }, 1500);
  }, [selectedPage]);

  async function handleCreatePage(e) {
    e.preventDefault();
    if (!newPageTitle.trim()) return;
    try {
      const page = await api.wiki.create({
        title: newPageTitle.trim(),
        project_id: Number(selectedProject),
        parent_page_id: newPageParentId,
      });
      setNewPageTitle('');
      setNewPageParentId(null);
      setShowNewPage(false);
      loadTree();
      loadPage(page.id);
      navigate(`/wiki/${page.id}`, { replace: true });
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDeletePage(id) {
    if (!confirm('Delete this wiki page?')) return;
    try {
      await api.wiki.delete(id);
      if (selectedPage?.id === id) setSelectedPage(null);
      loadTree();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleAddSubPage(parentId) {
    setNewPageParentId(parentId);
    setShowNewPage(true);
    setNewPageTitle('');
  }

  function handleCreateRequirement(selectedText, callback) {
    setCreateReqTitle(selectedText);
    setCreateReqCallback(() => callback);
    setShowCreateReq(true);
  }

  async function handleTitleChange(e) {
    const newTitle = e.target.value;
    if (!selectedPage) return;
    setSelectedPage(p => ({ ...p, title: newTitle }));
    // Debounced save title
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaveStatus('Saving...');
        await api.wiki.update(selectedPage.id, { title: newTitle });
        setSaveStatus('Saved');
        loadTree();
      } catch {
        setSaveStatus('Save failed');
      }
    }, 1500);
  }

  return (
    <Layout>
      <div className="page wiki-page-container">
        <div className="page-header">
          <h1 className="page-title">Wiki</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={selectedProject}
              onChange={e => { setSelectedProject(e.target.value); setSelectedPage(null); }}
              className="wiki-project-select"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {canEdit && (
              <button className="btn btn-primary btn-sm" onClick={() => { setNewPageParentId(null); setShowNewPage(true); setNewPageTitle(''); }}>
                + New Page
              </button>
            )}
          </div>
        </div>

        <div className="wiki-layout">
          <aside className="wiki-page-tree">
            <div className="tree-header">Pages</div>
            {tree.length === 0 ? (
              <div className="empty" style={{ padding: 16, fontSize: 13 }}>No pages yet. Create one to get started.</div>
            ) : (
              tree.map(node => (
                <TreeNode
                  key={node.id}
                  node={node}
                  selectedId={selectedPage?.id}
                  onSelect={handleSelectPage}
                  onAddSubPage={handleAddSubPage}
                  onDelete={handleDeletePage}
                  canEdit={canEdit}
                />
              ))
            )}
          </aside>

          <div className="wiki-editor-panel">
            {selectedPage ? (
              <>
                <div className="wiki-editor-header">
                  {canEdit ? (
                    <input
                      className="wiki-title-input"
                      value={selectedPage.title}
                      onChange={handleTitleChange}
                      placeholder="Page title"
                    />
                  ) : (
                    <h2 className="wiki-title">{selectedPage.title}</h2>
                  )}
                  {saveStatus && <span className={`wiki-save-status ${saveStatus === 'Saved' ? 'saved' : saveStatus === 'Save failed' ? 'error' : ''}`}>{saveStatus}</span>}
                </div>
                <WikiEditor
                  content={selectedPage.content}
                  onUpdate={handleEditorUpdate}
                  readOnly={!canEdit}
                  onCreateRequirement={canEdit ? handleCreateRequirement : undefined}
                  placeholder="Start writing... Use @ to reference requirements"
                />
              </>
            ) : (
              <div className="empty" style={{ marginTop: 60 }}>
                {tree.length > 0 ? 'Select a page from the tree' : 'Create a page to get started'}
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewPage && (
        <div className="modal-backdrop" onClick={() => setShowNewPage(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>{newPageParentId ? 'New Sub-page' : 'New Wiki Page'}</h2>
            <form onSubmit={handleCreatePage}>
              <div className="form-group">
                <label>Title *</label>
                <input value={newPageTitle} onChange={e => setNewPageTitle(e.target.value)} required autoFocus />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewPage(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateReq && (
        <CreateRequirementModal
          initialTitle={createReqTitle}
          onClose={() => { setShowCreateReq(false); setCreateReqCallback(null); }}
          onCreated={(req) => {
            setShowCreateReq(false);
            if (createReqCallback) createReqCallback(req);
            setCreateReqCallback(null);
          }}
        />
      )}
    </Layout>
  );
}
