import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function openChangePwd() {
    setPwdForm({ current: '', next: '', confirm: '' });
    setPwdError('');
    setPwdSuccess('');
    setShowChangePwd(true);
  }

  async function handleChangePwd(e) {
    e.preventDefault();
    setPwdError(''); setPwdSuccess('');
    if (pwdForm.next !== pwdForm.confirm) { setPwdError('New passwords do not match.'); return; }
    setPwdSaving(true);
    try {
      await api.users.changePassword(pwdForm.current, pwdForm.next);
      setPwdSuccess('Password changed successfully.');
      setPwdForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setPwdSaving(false);
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">📋 ReqPlan</div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard">
            <span>📊</span> Dashboard
          </NavLink>
          <NavLink to="/projects">
            <span>🗂️</span> Projects
          </NavLink>
          <NavLink to="/requirements">
            <span>📄</span> Requirements
          </NavLink>
          <NavLink to="/traceability">
            <span>🔗</span> Traceability
          </NavLink>
          <NavLink to="/reports">
            <span>📈</span> Reports
          </NavLink>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <NavLink to="/llm-import">
              <span>✨</span> AI Import
            </NavLink>
          )}
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <NavLink to="/tags">
              <span>🏷️</span> Tags
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/users">
              <span>👥</span> Users
            </NavLink>
          )}
          <NavLink to="/guide">
            <span>📖</span> User Guide
          </NavLink>
        </nav>
        <div className="sidebar-user">
          <div className="username">{user?.username}</div>
          <div className="role">{user?.role}</div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: 8 }}
            onClick={openChangePwd}
          >
            Change Password
          </button>
          <button
            className="btn btn-secondary btn-sm mt-4"
            style={{ width: '100%', marginTop: 8 }}
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        {children}
      </main>

      {showChangePwd && (
        <div className="modal-backdrop" onClick={() => setShowChangePwd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Change Password</h2>
            {pwdError && <div className="alert alert-error">{pwdError}</div>}
            {pwdSuccess && <div className="alert alert-success">{pwdSuccess}</div>}
            <form onSubmit={handleChangePwd}>
              <div className="form-group">
                <label>Current Password *</label>
                <input
                  type="password"
                  value={pwdForm.current}
                  onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password *</label>
                <input
                  type="password"
                  value={pwdForm.next}
                  onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))}
                  minLength={6}
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password *</label>
                <input
                  type="password"
                  value={pwdForm.confirm}
                  onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowChangePwd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={pwdSaving}>
                  {pwdSaving ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
