import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

const EMPTY_FORM = { username: '', email: '', password: '', role: 'viewer' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const { user: me } = useAuth();

  // Reset password state
  const [resetTarget, setResetTarget] = useState(null); // { id, username }
  const [resetPwd, setResetPwd] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    api.users.list().then(setUsers).catch(err => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const newUser = await api.users.create(form);
      setUsers(prev => [...prev, newUser]);
      setForm(EMPTY_FORM);
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(id, role) {
    try {
      const updated = await api.users.setRole(id, role);
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetError('');
    if (resetPwd !== resetConfirm) { setResetError('Passwords do not match.'); return; }
    setResetting(true);
    try {
      await api.users.resetPassword(resetTarget.id, resetPwd);
      setResetTarget(null);
      setResetPwd('');
      setResetConfirm('');
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this user?')) return;
    try {
      await api.users.delete(id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">Users</h1>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New User</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{u.username}</span>
                      {u.id === me?.id && <span className="badge badge-active" style={{ marginLeft: 6 }}>You</span>}
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        disabled={u.id === me?.id}
                        style={{ width: 'auto' }}
                      >
                        <option value="viewer">viewer</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="text-muted text-sm">{u.created_at?.slice(0, 10)}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setResetTarget(u); setResetPwd(''); setResetConfirm(''); setResetError(''); }}
                      >
                        Reset Password
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === me?.id}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {resetTarget && (
        <div className="modal-backdrop" onClick={() => setResetTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Reset Password — {resetTarget.username}</h2>
            {resetError && <div className="alert alert-error">{resetError}</div>}
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <label>New Password *</label>
                <input
                  type="password"
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password *</label>
                <input
                  type="password"
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={resetting}>
                  {resetting ? 'Saving…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create User Account</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Username *</label>
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="viewer">viewer</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setError(''); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
