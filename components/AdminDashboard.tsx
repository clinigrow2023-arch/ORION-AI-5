import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../lib/auth';
import { Users, Ban, CheckCircle, Key, Loader2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isBlocked: boolean;
  isActive: boolean;
  accessExpiresAt: string | null;
  createdAt: string;
}

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = authService.getToken();
      if (!token) {
        throw new Error('No token found');
      }

      const response = await fetch('/.netlify/functions/admin-users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied. Admin privileges required.');
        }
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateUser = async (userId: string, updates: { isBlocked?: boolean; grantAccess?: boolean }) => {
    try {
      setUpdating(userId);
      setError(null);
      const token = authService.getToken();
      if (!token) {
        throw new Error('No token found');
      }

      const response = await fetch('/.netlify/functions/admin-users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, ...updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user');
      }

      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setUpdating(null);
    }
  };

  const handleBlockToggle = (user: User) => {
    updateUser(user.id, { isBlocked: !user.isBlocked });
  };

  const handleGrantAccess = (userId: string) => {
    updateUser(userId, { grantAccess: true });
  };

  const handleRevokeAccess = (userId: string) => {
    updateUser(userId, { grantAccess: false });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isAccessExpired = (dateString: string | null) => {
    if (!dateString) return true;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={48} />
          <p className="text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-slate-400">Manage users, blocks, and access permissions</p>
          </div>
          <button
            onClick={fetchUsers}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Blocked</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Access</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Expires</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                          <Users size={20} className="text-white" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.isBlocked ? (
                        <span className="flex items-center gap-2 text-red-400">
                          <Ban size={16} />
                          <span className="text-sm">Blocked</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-green-400">
                          <CheckCircle size={16} />
                          <span className="text-sm">Active</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <span className="flex items-center gap-2 text-green-400">
                          <Key size={16} />
                          <span className="text-sm">Granted</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-slate-500">
                          <XCircle size={16} />
                          <span className="text-sm">Not Granted</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.accessExpiresAt ? (
                        <span className={`text-sm ${
                          isAccessExpired(user.accessExpiresAt)
                            ? 'text-red-400'
                            : 'text-slate-300'
                        }`}>
                          {formatDate(user.accessExpiresAt)}
                          {isAccessExpired(user.accessExpiresAt) && (
                            <span className="ml-2 text-xs">(Expired)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleBlockToggle(user)}
                          disabled={updating === user.id}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            user.isBlocked
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          } disabled:opacity-50`}
                        >
                          {updating === user.id ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : user.isBlocked ? (
                            'Unblock'
                          ) : (
                            'Block'
                          )}
                        </button>
                        {user.isActive ? (
                          <button
                            onClick={() => handleRevokeAccess(user.id)}
                            disabled={updating === user.id}
                            className="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                          >
                            {updating === user.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              'Revoke'
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGrantAccess(user.id)}
                            disabled={updating === user.id}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                          >
                            {updating === user.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              'Grant Access'
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {users.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

