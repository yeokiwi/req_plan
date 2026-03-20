import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
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
        </nav>
        <div className="sidebar-user">
          <div className="username">{user?.username}</div>
          <div className="role">{user?.role}</div>
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
    </div>
  );
}
