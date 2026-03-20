import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const { user: me } = useAuth();

  useEffect(() => {
    api.users.list().then(setUsers).catch(err => setError(err.message));
  }, []);

  async function handleRoleChange(id, role) {
    try {
      const updated = await api.users.setRole(id, role);
      setUsers(prev => prev.map(u => u.id === id ? updated : u));
    } catch (err) {
      setError(err.message);
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
                    <td>
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
    </Layout>
  );
}
