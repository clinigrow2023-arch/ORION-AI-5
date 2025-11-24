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
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [roleChangeConfirm, setRoleChangeConfirm] = useState<{ userId: string; newRole: string; userName: string } | null>(null);
  const [showPromoteByEmail, setShowPromoteByEmail] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);

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

  const updateUser = async (userId: string, updates: { isBlocked?: boolean; grantAccess?: boolean; accessExpiresAt?: string; updateExpirationDate?: boolean; role?: string }) => {
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

  const handleGrantAccess = (userId: string, customDate?: string) => {
    updateUser(userId, { grantAccess: true, accessExpiresAt: customDate });
  };

  const handleRevokeAccess = (userId: string) => {
    updateUser(userId, { grantAccess: false });
  };

  const handleRoleChange = (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setRoleChangeConfirm({ userId: user.id, newRole, userName: user.name });
  };

  const confirmRoleChange = () => {
    if (roleChangeConfirm) {
      updateUser(roleChangeConfirm.userId, { role: roleChangeConfirm.newRole });
      setRoleChangeConfirm(null);
    }
  };

  const cancelRoleChange = () => {
    setRoleChangeConfirm(null);
  };

  const handlePromoteByEmail = async () => {
    if (!promoteEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    try {
      setPromoting(true);
      setError(null);
      const token = authService.getToken();
      if (!token) {
        throw new Error('No token found');
      }

      const response = await fetch('/.netlify/functions/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ email: promoteEmail.trim(), role: 'admin' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to promote user');
      }

      setPromoteEmail('');
      setShowPromoteByEmail(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to promote user');
    } finally {
      setPromoting(false);
    }
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
    <div className="min-h-screen bg-slate-950 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-slate-400">Manage users, blocks, and access permissions</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowPromoteByEmail(!showPromoteByEmail)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm md:text-base"
            >
              <Users size={18} className="md:w-5 md:h-5" />
              <span className="hidden sm:inline">Promote by Email</span>
              <span className="sm:hidden">Promote</span>
            </button>
            <button
              onClick={fetchUsers}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm md:text-base"
            >
              <RefreshCw size={18} className="md:w-5 md:h-5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Seção para promover por email */}
        {showPromoteByEmail && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-slate-900 rounded-xl border border-slate-800">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3">Promote User to Admin by Email</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <input
                type="email"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                placeholder="Enter user email address"
                className="flex-1 px-3 md:px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handlePromoteByEmail();
                  }
                }}
              />
              <button
                onClick={handlePromoteByEmail}
                disabled={promoting || !promoteEmail.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
              >
                {promoting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span className="hidden sm:inline">Promoting...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  'Promote'
                )}
              </button>
              <button
                onClick={() => {
                  setShowPromoteByEmail(false);
                  setPromoteEmail('');
                }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm md:text-base">
            <AlertCircle size={18} className="md:w-5 md:h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden lg:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800 border-b border-slate-700">
                <tr>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">User</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">Email</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">Role</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">Blocked</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">Access</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">Expires</th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users size={16} className="lg:w-5 lg:h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm lg:text-base truncate">{user.name}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4 text-slate-300 text-sm lg:text-base">
                      <span className="truncate block max-w-[200px] lg:max-w-none">{user.email}</span>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}>
                          {user.role}
                        </span>
                        <button
                          onClick={() => handleRoleChange(user)}
                          disabled={updating === user.id || (user.role === 'admin' && user.id === currentUser?.id)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.role === 'admin'
                              ? 'bg-orange-600 hover:bg-orange-700 text-white'
                              : 'bg-purple-600 hover:bg-purple-700 text-white'
                          }`}
                          title={
                            user.role === 'admin' && user.id === currentUser?.id
                              ? 'You cannot demote yourself'
                              : user.role === 'admin'
                              ? 'Demote to user'
                              : 'Promote to admin'
                          }
                        >
                          {updating === user.id ? (
                            <Loader2 className="animate-spin" size={12} />
                          ) : user.role === 'admin' ? (
                            'Demote'
                          ) : (
                            'Promote'
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      {user.isBlocked ? (
                        <span className="flex items-center gap-1.5 lg:gap-2 text-red-400">
                          <Ban size={14} className="lg:w-4 lg:h-4" />
                          <span className="text-xs lg:text-sm">Blocked</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 lg:gap-2 text-green-400">
                          <CheckCircle size={14} className="lg:w-4 lg:h-4" />
                          <span className="text-xs lg:text-sm">Active</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      {user.isActive ? (
                        <span className="flex items-center gap-1.5 lg:gap-2 text-green-400">
                          <Key size={14} className="lg:w-4 lg:h-4" />
                          <span className="text-xs lg:text-sm">Granted</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 lg:gap-2 text-slate-500">
                          <XCircle size={14} className="lg:w-4 lg:h-4" />
                          <span className="text-xs lg:text-sm">Not Granted</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      {user.accessExpiresAt ? (
                        <span className={`text-xs lg:text-sm ${
                          isAccessExpired(user.accessExpiresAt)
                            ? 'text-red-400'
                            : 'text-slate-300'
                        }`}>
                          {formatDate(user.accessExpiresAt)}
                          {isAccessExpired(user.accessExpiresAt) && (
                            <span className="ml-1 lg:ml-2 text-xs">(Expired)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs lg:text-sm text-slate-500">N/A</span>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleBlockToggle(user)}
                          disabled={updating === user.id}
                          className={`px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium transition-colors ${
                            user.isBlocked
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          } disabled:opacity-50`}
                        >
                          {updating === user.id ? (
                            <Loader2 className="animate-spin lg:w-4 lg:h-4" size={14} />
                          ) : user.isBlocked ? (
                            'Unblock'
                          ) : (
                            'Block'
                          )}
                        </button>
                        {user.isActive ? (
                          <>
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
                            {showDatePicker === user.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={selectedDate || (user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString().split('T')[0] : '')}
                                  onChange={(e) => setSelectedDate(e.target.value)}
                                  min={new Date().toISOString().split('T')[0]}
                                  className="px-2 py-1 bg-slate-800 text-slate-200 rounded text-sm border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => {
                                    if (selectedDate) {
                                      updateUser(user.id, { updateExpirationDate: true, accessExpiresAt: selectedDate });
                                      setShowDatePicker(null);
                                      setSelectedDate("");
                                    }
                                  }}
                                  disabled={updating === user.id}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                >
                                  {updating === user.id ? (
                                    <Loader2 className="animate-spin" size={16} />
                                  ) : (
                                    'Save'
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowDatePicker(null);
                                    setSelectedDate("");
                                  }}
                                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setShowDatePicker(user.id);
                                  setSelectedDate(user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString().split('T')[0] : '');
                                }}
                                disabled={updating === user.id}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                title="Edit expiration date"
                              >
                                Edit Date
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            {showDatePicker === user.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="date"
                                  value={selectedDate}
                                  onChange={(e) => setSelectedDate(e.target.value)}
                                  min={new Date().toISOString().split('T')[0]}
                                  className="px-2 py-1 bg-slate-800 text-slate-200 rounded text-sm border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => {
                                    if (selectedDate) {
                                      handleGrantAccess(user.id, selectedDate);
                                      setShowDatePicker(null);
                                      setSelectedDate("");
                                    } else {
                                      // Se não selecionou data, usar padrão (1 mês)
                                      handleGrantAccess(user.id);
                                      setShowDatePicker(null);
                                      setSelectedDate("");
                                    }
                                  }}
                                  disabled={updating === user.id}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                >
                                  {updating === user.id ? (
                                    <Loader2 className="animate-spin" size={16} />
                                  ) : (
                                    'Confirm'
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowDatePicker(null);
                                    setSelectedDate("");
                                  }}
                                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    // Data padrão: 1 mês (não passar data, deixar backend calcular)
                                    handleGrantAccess(user.id);
                                  }}
                                  disabled={updating === user.id}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                  title="Grant access for 1 month (default)"
                                >
                                  {updating === user.id ? (
                                    <Loader2 className="animate-spin" size={16} />
                                  ) : (
                                    '1 Month'
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setShowDatePicker(user.id);
                                    setSelectedDate("");
                                  }}
                                  disabled={updating === user.id}
                                  className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-sm font-medium disabled:opacity-50 transition-colors"
                                  title="Choose custom date"
                                >
                                  Custom
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {users.map((user) => (
            <div key={user.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    user.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {user.role}
                  </span>
                  <button
                    onClick={() => handleRoleChange(user)}
                    disabled={updating === user.id || (user.role === 'admin' && user.id === currentUser?.id)}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      user.role === 'admin'
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {updating === user.id ? (
                      <Loader2 className="animate-spin" size={12} />
                    ) : user.role === 'admin' ? (
                      'Demote'
                    ) : (
                      'Promote'
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {user.isBlocked ? (
                    <span className="flex items-center gap-1.5 text-red-400 text-xs">
                      <Ban size={14} />
                      <span>Blocked</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-green-400 text-xs">
                      <CheckCircle size={14} />
                      <span>Active</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {user.isActive ? (
                    <span className="flex items-center gap-1.5 text-green-400 text-xs">
                      <Key size={14} />
                      <span>Granted</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                      <XCircle size={14} />
                      <span>Not Granted</span>
                    </span>
                  )}
                </div>
              </div>

              {user.accessExpiresAt && (
                <div className="mb-4">
                  <p className="text-xs text-slate-400 mb-1">Expires:</p>
                  <p className={`text-sm ${
                    isAccessExpired(user.accessExpiresAt)
                      ? 'text-red-400'
                      : 'text-slate-300'
                  }`}>
                    {formatDate(user.accessExpiresAt)}
                    {isAccessExpired(user.accessExpiresAt) && (
                      <span className="ml-2 text-xs">(Expired)</span>
                    )}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleBlockToggle(user)}
                  disabled={updating === user.id}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex-1 min-w-[80px] ${
                    user.isBlocked
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  } disabled:opacity-50`}
                >
                  {updating === user.id ? (
                    <Loader2 className="animate-spin mx-auto" size={14} />
                  ) : user.isBlocked ? (
                    'Unblock'
                  ) : (
                    'Block'
                  )}
                </button>
                {user.isActive ? (
                  <>
                    <button
                      onClick={() => handleRevokeAccess(user.id)}
                      disabled={updating === user.id}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors flex-1 min-w-[80px]"
                    >
                      {updating === user.id ? (
                        <Loader2 className="animate-spin mx-auto" size={14} />
                      ) : (
                        'Revoke'
                      )}
                    </button>
                    {showDatePicker === user.id ? (
                      <div className="w-full flex flex-col gap-2">
                        <input
                          type="date"
                          value={selectedDate || (user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString().split('T')[0] : '')}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-2 py-1.5 bg-slate-800 text-slate-200 rounded text-xs border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (selectedDate) {
                                updateUser(user.id, { updateExpirationDate: true, accessExpiresAt: selectedDate });
                                setShowDatePicker(null);
                                setSelectedDate("");
                              }
                            }}
                            disabled={updating === user.id}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            {updating === user.id ? (
                              <Loader2 className="animate-spin mx-auto" size={14} />
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowDatePicker(null);
                              setSelectedDate("");
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowDatePicker(user.id);
                          setSelectedDate(user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString().split('T')[0] : '');
                        }}
                        disabled={updating === user.id}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors flex-1 min-w-[80px]"
                      >
                        Edit Date
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {showDatePicker === user.id ? (
                      <div className="w-full flex flex-col gap-2">
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-2 py-1.5 bg-slate-800 text-slate-200 rounded text-xs border border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (selectedDate) {
                                handleGrantAccess(user.id, selectedDate);
                                setShowDatePicker(null);
                                setSelectedDate("");
                              } else {
                                handleGrantAccess(user.id);
                                setShowDatePicker(null);
                                setSelectedDate("");
                              }
                            }}
                            disabled={updating === user.id}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors"
                          >
                            {updating === user.id ? (
                              <Loader2 className="animate-spin mx-auto" size={14} />
                            ) : (
                              'Confirm'
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowDatePicker(null);
                              setSelectedDate("");
                            }}
                            className="flex-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleGrantAccess(user.id)}
                          disabled={updating === user.id}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors flex-1 min-w-[80px]"
                        >
                          {updating === user.id ? (
                            <Loader2 className="animate-spin mx-auto" size={14} />
                          ) : (
                            '1 Month'
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setShowDatePicker(user.id);
                            setSelectedDate("");
                          }}
                          disabled={updating === user.id}
                          className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors flex-1 min-w-[80px]"
                        >
                          Custom
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {users.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No users found</p>
          </div>
        )}
      </div>

      {/* Modal de confirmação de mudança de role */}
      {roleChangeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 md:p-6 max-w-md w-full">
            <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Confirm Role Change</h3>
            <p className="text-sm md:text-base text-slate-300 mb-4 md:mb-6">
              Are you sure you want to change <span className="font-semibold text-white">{roleChangeConfirm.userName}</span>'s role from{' '}
              <span className={`font-semibold ${roleChangeConfirm.newRole === 'admin' ? 'text-purple-400' : 'text-slate-400'}`}>
                {roleChangeConfirm.newRole === 'admin' ? 'user' : 'admin'}
              </span>{' '}
              to{' '}
              <span className={`font-semibold ${roleChangeConfirm.newRole === 'admin' ? 'text-purple-400' : 'text-slate-400'}`}>
                {roleChangeConfirm.newRole}
              </span>?
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={confirmRoleChange}
                disabled={updating === roleChangeConfirm.userId}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                {updating === roleChangeConfirm.userId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="hidden sm:inline">Updating...</span>
                    <span className="sm:hidden">...</span>
                  </span>
                ) : (
                  'Confirm'
                )}
              </button>
              <button
                onClick={cancelRoleChange}
                disabled={updating === roleChangeConfirm.userId}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

