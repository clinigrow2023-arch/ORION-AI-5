import {
  AlertCircle,
  Ban,
  Bot,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../lib/auth";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
}

const USER_PAGE_SIZES = [25, 50, 100] as const;

/** Busca local: digitar não re-renderiza o painel inteiro; só o pai atualiza após debounce */
const AdminUserSearchBar = React.memo(function AdminUserSearchBar({
  onDebouncedChange,
}: {
  onDebouncedChange: (query: string) => void;
}) {
  const [local, setLocal] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNotify = useCallback(
    (raw: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onDebouncedChange(raw.trim());
      }, 420);
    },
    [onDebouncedChange]
  );

  useEffect(() => {
    scheduleNotify(local);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [local, scheduleNotify]);

  const clearNow = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLocal("");
    onDebouncedChange("");
  };

  return (
    <div className="mb-4 md:mb-6">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none"
          size={20}
        />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          className="w-full pl-10 pr-10 py-2 md:py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm md:text-base"
        />
        {local ? (
          <button
            type="button"
            onClick={clearNow}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
            title="Clear search"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>
    </div>
  );
});

const AdminDashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  /** Primeira carga da lista na aba Users (tela cheia); depois só refresh suave */
  const [usersBootstrapping, setUsersBootstrapping] = useState(true);
  const [usersRefreshing, setUsersRefreshing] = useState(false);
  const [totalUsersMatching, setTotalUsersMatching] = useState(0);
  const usersListInitialized = useRef(false);
  const usersFetchSeq = useRef(0);
  const prevSearchForLoadRef = useRef<string | null>(null);
  const lastSuccessfulListKey = useRef("");
  const listParamsRef = useRef({ page: 1, size: 25, q: "" });
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blockConfirm, setBlockConfirm] = useState<{
    userId: string;
    userName: string;
    isBlocked: boolean;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
  } | null>(null);
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState<{
    userId: string;
    userName: string;
  } | null>(null);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof USER_PAGE_SIZES)[number]>(25);
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [searchBarKey, setSearchBarKey] = useState(0);
  const [activeTab, setActiveTab] = useState<"users" | "create" | "prompt">("users");

  listParamsRef.current = {
    page: userPage,
    size: pageSize,
    q: debouncedSearchQuery,
  };
  const [createUserEmail, setCreateUserEmail] = useState("");
  const [createUserName, setCreateUserName] = useState("");
  const [createUserRole, setCreateUserRole] = useState<"user" | "admin">("user");
  const [creatingUser, setCreatingUser] = useState(false);
  const [roleModal, setRoleModal] = useState<{
    userId: string;
    userName: string;
    initialRole: "user" | "admin";
    selectedRole: "user" | "admin";
  } | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptVersion, setPromptVersion] = useState(0);
  const [promptUpdatedAt, setPromptUpdatedAt] = useState<string | null>(null);
  const [promptSuccess, setPromptSuccess] = useState<string | null>(null);

  const loadUserList = async (
    page: number,
    limit: number,
    search: string,
    opts?: { bypassDedupe?: boolean }
  ) => {
    const dedupeKey = `${search}|${page}|${limit}`;
    if (!opts?.bypassDedupe && dedupeKey === lastSuccessfulListKey.current) {
      return;
    }

    const seq = ++usersFetchSeq.current;
    const isRepeatFetch = usersListInitialized.current;

    try {
      setError(null);
      if (isRepeatFetch) {
        setUsersRefreshing(true);
      } else {
        setUsersBootstrapping(true);
      }

      const token = authService.getToken();
      if (!token) {
        throw new Error("No token found");
      }

      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const response = await fetch(
        `${getApiEndpoint(
          "admin-users"
        )}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      if (seq !== usersFetchSeq.current) {
        return;
      }

      const list = data.users || [];
      setUsers(list);
      const total = data.pagination?.totalItems;
      setTotalUsersMatching(
        typeof total === "number" ? total : list.length
      );
      const cur = data.pagination?.currentPage;
      const tp = data.pagination?.totalPages;
      setListCurrentPage(typeof cur === "number" ? cur : page);
      setListTotalPages(
        typeof tp === "number"
          ? Math.max(1, tp)
          : Math.max(1, Math.ceil((total ?? list.length) / limit))
      );
      setUserPage(typeof cur === "number" ? cur : page);
      lastSuccessfulListKey.current = dedupeKey;
      usersListInitialized.current = true;
    } catch (err: any) {
      if (seq === usersFetchSeq.current) {
        setError(err.message || "Failed to load users");
      }
    } finally {
      if (seq === usersFetchSeq.current) {
        setUsersBootstrapping(false);
        setUsersRefreshing(false);
      }
    }
  };

  const reloadAfterMutation = () => {
    const { page, size, q } = listParamsRef.current;
    return loadUserList(page, size, q, { bypassDedupe: true });
  };

  useEffect(() => {
    if (activeTab !== "users") {
      return;
    }

    const searchChanged =
      prevSearchForLoadRef.current !== null &&
      prevSearchForLoadRef.current !== debouncedSearchQuery;
    prevSearchForLoadRef.current = debouncedSearchQuery;

    const pageToFetch = searchChanged ? 1 : userPage;

    void loadUserList(pageToFetch, pageSize, debouncedSearchQuery);
  }, [activeTab, debouncedSearchQuery, userPage, pageSize]);

  useEffect(() => {
    if (activeTab === "prompt") {
      fetchSystemPrompt();
    }
  }, [activeTab]);

  const fetchSystemPrompt = async () => {
    try {
      setPromptLoading(true);
      setError(null);
      setPromptSuccess(null);
      const token = authService.getToken();
      if (!token) {
        throw new Error("No token found");
      }

      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const response = await fetch(getApiEndpoint("system-prompt"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied. Admin privileges required.");
        }
        throw new Error("Failed to fetch system prompt");
      }

      const data = await response.json();
      setSystemPrompt(data.prompt || "");
      setPromptVersion(data.version || 0);
      if (data.updatedAt) {
        const date = new Date(data.updatedAt);
        setPromptUpdatedAt(date.toLocaleString());
      } else {
        setPromptUpdatedAt(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load system prompt");
    } finally {
      setPromptLoading(false);
    }
  };

  const saveSystemPrompt = async () => {
    if (!systemPrompt.trim()) {
      setError("Prompt cannot be empty");
      return;
    }

    try {
      setPromptSaving(true);
      setError(null);
      setPromptSuccess(null);
      const token = authService.getToken();
      if (!token) {
        throw new Error("No token found");
      }

      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const response = await fetch(getApiEndpoint("system-prompt"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: systemPrompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
        }
        throw new Error(errorData.error || "Failed to save system prompt");
      }

      const data = await response.json();
      setPromptVersion(data.version);
      if (data.updatedAt) {
        const date = new Date(data.updatedAt);
        setPromptUpdatedAt(date.toLocaleString());
      }
      setPromptSuccess(
        `✅ Prompt saved successfully! Version ${data.version} is now active. All AI providers (Ollama, Groq, OpenAI, etc.) will use this prompt.`
      );
      setError(null);
      
      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => {
        setPromptSuccess(null);
      }, 5000);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to save system prompt";
      setError(errorMessage);
      setPromptSuccess(null);
      console.error("Error saving prompt:", err);
    } finally {
      setPromptSaving(false);
    }
  };

  const updateUser = async (
    userId: string,
    updates: {
      isBlocked?: boolean;
      role?: "user" | "admin";
    }
  ): Promise<boolean> => {
    try {
      setUpdating(userId);
      setError(null);
      const token = authService.getToken();
      if (!token) {
        throw new Error("No token found");
      }

      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const response = await fetch(getApiEndpoint("admin-users"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update user");
      }

      await reloadAfterMutation();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to update user");
      return false;
    } finally {
      setUpdating(null);
    }
  };

  const openRoleModal = (user: User) => {
    const initial = user.role === "admin" ? "admin" : "user";
    setRoleModal({
      userId: user.id,
      userName: user.name,
      initialRole: initial,
      selectedRole: initial,
    });
  };

  const confirmRoleChange = async () => {
    if (!roleModal) return;
    if (roleModal.selectedRole === roleModal.initialRole) {
      setRoleModal(null);
      return;
    }
    const ok = await updateUser(roleModal.userId, {
      role: roleModal.selectedRole,
    });
    if (ok) {
      setRoleModal(null);
    }
  };

  const cancelRoleChange = () => setRoleModal(null);

  const handleBlockToggle = (user: User) => {
    setBlockConfirm({
      userId: user.id,
      userName: user.name,
      isBlocked: user.isBlocked,
    });
  };

  const confirmBlockToggle = () => {
    if (blockConfirm) {
      updateUser(blockConfirm.userId, { isBlocked: !blockConfirm.isBlocked });
      setBlockConfirm(null);
    }
  };

  const cancelBlockToggle = () => {
    setBlockConfirm(null);
  };

  const handleDeleteUser = (user: User) => {
    setDeleteConfirm({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
    });
  };

  const confirmDeleteUser = async () => {
    if (deleteConfirm) {
      try {
        setUpdating(deleteConfirm.userId);
        setError(null);
        const token = authService.getToken();
        if (!token) {
          throw new Error("No token found");
        }

        const { getApiEndpoint } = await import("../lib/api-endpoints");
        const response = await fetch(
          `${getApiEndpoint("admin-users")}?userId=${encodeURIComponent(
            deleteConfirm.userId
          )}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to delete user");
        }

        setDeleteConfirm(null);
        await reloadAfterMutation();
      } catch (err: any) {
        setError(err.message || "Failed to delete user");
      } finally {
        setUpdating(null);
      }
    }
  };

  const cancelDeleteUser = () => {
    setDeleteConfirm(null);
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordConfirm({ userId: user.id, userName: user.name });
  };

  const confirmResetPassword = async () => {
    if (resetPasswordConfirm) {
      try {
        setUpdating(resetPasswordConfirm.userId);
        setError(null);
        const token = authService.getToken();
        if (!token) {
          throw new Error("No token found");
        }

        const { getApiEndpoint } = await import("../lib/api-endpoints");
        const response = await fetch(getApiEndpoint("admin-users"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: resetPasswordConfirm.userId,
            resetPassword: true,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to reset password");
        }

        const data = await response.json();
        if (data.emailSent === false) {
          setError(
            "Password was reset, but the email could not be sent. Configure GMAIL_USER and GMAIL_PASS on the server, or share access with the user manually."
          );
        } else {
          setError(null);
        }

        setResetPasswordConfirm(null);
        await reloadAfterMutation();
      } catch (err: any) {
        setError(err.message || "Failed to reset password");
      } finally {
        setUpdating(null);
      }
    }
  };

  const cancelResetPassword = () => {
    setResetPasswordConfirm(null);
  };

  // Criar usuário manualmente
  const handleCreateUser = async () => {
    if (!createUserEmail.trim() || !createUserName.trim()) {
      setError("Email and name are required");
      return;
    }

    // Validar formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserEmail)) {
      setError("Invalid email format");
      return;
    }

    try {
      setCreatingUser(true);
      setError(null);
      setCreateUserSuccess(null);
      const token = authService.getToken();
      if (!token) {
        throw new Error("No token found");
      }

      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const response = await fetch(getApiEndpoint("admin-users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: createUserEmail.toLowerCase().trim(),
          name: createUserName.trim(),
          role: createUserRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create user");
      }

      const data = await response.json();
      let successMsg = `User ${data.user.email} was created successfully.`;
      if (data.passwordGenerated) {
        successMsg += data.emailSent
          ? " A temporary password was sent by email."
          : " Email was not sent (configure GMAIL_USER/GMAIL_PASS on the server). You can use Reset PW to email a new temporary password once Gmail is configured.";
      }
      setCreateUserSuccess(successMsg);
      setCreateUserEmail("");
      setCreateUserName("");
      setCreateUserRole("user");
      setUserPage(1);
      await loadUserList(1, pageSize, debouncedSearchQuery, {
        bypassDedupe: true,
      });
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRefreshClick = () => {
    void reloadAfterMutation();
  };

  if (activeTab === "users" && usersBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2
            className="animate-spin text-indigo-500 mx-auto mb-4"
            size={48}
          />
          <p className="text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-950 p-3 md:p-6 flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">
              Admin Dashboard
            </h1>
            <p className="text-sm md:text-base text-slate-400">
              Manage users, blocks, and passwords
            </p>
            {activeTab === "users" && (
              <p className="text-sm md:text-base text-indigo-400 mt-1">
                {debouncedSearchQuery.trim() ? (
                  <>
                    Matches:{" "}
                    <span className="font-semibold">{totalUsersMatching}</span>
                    {listTotalPages > 1 ? (
                      <span className="text-slate-500 font-normal">
                        {" "}
                        · page {listCurrentPage} of {listTotalPages} (
                        {pageSize} per page)
                      </span>
                    ) : null}
                  </>
                ) : (
                  <>
                    Total users:{" "}
                    <span className="font-semibold">{totalUsersMatching}</span>
                    {listTotalPages > 1 ? (
                      <span className="text-slate-500 font-normal">
                        {" "}
                        · page {listCurrentPage} of {listTotalPages} (
                        {pageSize} per page)
                      </span>
                    ) : null}
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button
              onClick={handleRefreshClick}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm md:text-base"
            >
              <RefreshCw size={18} className="md:w-5 md:h-5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 md:mb-6 flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "users"
                ? "text-indigo-400 border-b-2 border-indigo-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <Users size={18} />
              Users
              {totalUsersMatching > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                  {totalUsersMatching}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "create"
                ? "text-indigo-400 border-b-2 border-indigo-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <UserPlus size={18} />
              Create User
            </span>
          </button>
          <button
            onClick={() => setActiveTab("prompt")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "prompt"
                ? "text-indigo-400 border-b-2 border-indigo-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            <span className="flex items-center gap-2">
              <Bot size={18} />
              AI Prompt
            </span>
          </button>
        </div>

        {/* Create User Tab */}
        {activeTab === "create" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 md:p-6">
            <div className="max-w-2xl mx-auto">
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                  Create User Manually
                </h2>
                <p className="text-sm md:text-base text-slate-400">
                  Use this when a DigiStore payment was approved but email wasn't sent, or if there was an error. A random password will be generated and sent via email.
                </p>
              </div>

              {createUserSuccess && (
                <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-400 text-sm md:text-base">
                  <CheckCircle size={18} className="md:w-5 md:h-5 shrink-0" />
                  <span>{createUserSuccess}</span>
                </div>
              )}

              {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm md:text-base">
                  <AlertCircle size={18} className="md:w-5 md:h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="flex items-center gap-2">
                      <Mail size={16} />
                      Email
                    </span>
                  </label>
                  <input
                    type="email"
                    value={createUserEmail}
                    onChange={(e) => setCreateUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm md:text-base"
                    disabled={creatingUser}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <span className="flex items-center gap-2">
                      <Users size={16} />
                      Name
                    </span>
                  </label>
                  <input
                    type="text"
                    value={createUserName}
                    onChange={(e) => setCreateUserName(e.target.value)}
                    placeholder="User Name"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm md:text-base"
                    disabled={creatingUser}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Role
                  </label>
                  <select
                    value={createUserRole}
                    onChange={(e) =>
                      setCreateUserRole(e.target.value as "user" | "admin")
                    }
                    disabled={creatingUser}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm md:text-base"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <button
                  onClick={handleCreateUser}
                  disabled={creatingUser || !createUserEmail.trim() || !createUserName.trim()}
                  className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base flex items-center justify-center gap-2"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      <span>Create User & Send Email</span>
                    </>
                  )}
                </button>

                <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs md:text-sm text-slate-400">
                    <strong className="text-slate-300">Note:</strong> A random password will be automatically generated and sent to the user's email. The user will be required to change this password on their first login.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Prompt Tab */}
        {activeTab === "prompt" && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 md:p-6 flex-1 min-h-0 flex flex-col">
            <div className="mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                System Prompt Management
              </h2>
              <p className="text-sm md:text-base text-slate-400 mb-3">
                Edit the system instruction that all AI providers (Ollama, Groq, OpenAI, etc.) will use. Changes apply globally to all AI responses.
              </p>
              
              {/* Status do Prompt Atual */}
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 md:p-4 mb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-300 mb-1">
                      Current Active Prompt
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      {promptVersion > 0 ? (
                        <>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Version {promptVersion}
                          </span>
                          {promptUpdatedAt && (
                            <span>• Last updated: {promptUpdatedAt}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500">No prompt saved yet</span>
                      )}
                    </div>
                  </div>
                  {promptVersion > 0 && (
                    <div className="text-xs text-indigo-400 font-medium">
                      ✅ Active on all AI providers
                    </div>
                  )}
                </div>
              </div>

              {/* Mensagem de Sucesso */}
              {promptSuccess && (
                <div className="mb-4 p-3 md:p-4 bg-green-900/30 border border-green-700 rounded-lg">
                  <p className="text-sm md:text-base text-green-300">{promptSuccess}</p>
                </div>
              )}
            </div>

            {promptLoading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-center">
                  <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={48} />
                  <p className="text-slate-400">Loading prompt...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    System Instruction
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-full min-h-[400px] p-4 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter the system instruction for all AI providers..."
                  />
                </div>
                <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
                  <div className="text-xs text-slate-500">
                    {systemPrompt.length} characters
                  </div>
                  <button
                    onClick={saveSystemPrompt}
                    disabled={promptSaving || !systemPrompt.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                  >
                    {promptSaving ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save Prompt
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <>
        <AdminUserSearchBar
          key={searchBarKey}
          onDebouncedChange={setDebouncedSearchQuery}
        />
        {debouncedSearchQuery.trim() ? (
          <p className="mb-3 text-sm text-slate-400 -mt-2">
            This page: {users.length} users · total matches:{" "}
            {totalUsersMatching}
          </p>
        ) : null}

        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Per page</span>
            <select
              value={pageSize}
              disabled={usersRefreshing}
              onChange={(e) => {
                const n = Number(e.target.value) as (typeof USER_PAGE_SIZES)[number];
                setPageSize(n);
                setUserPage(1);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {USER_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              disabled={listCurrentPage <= 1 || usersRefreshing}
              onClick={() => setUserPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              <ChevronLeft size={18} />
              Prev
            </button>
            <span className="text-slate-400 tabular-nums px-1">
              Page {listCurrentPage} of {listTotalPages}
            </span>
            <button
              type="button"
              disabled={
                listCurrentPage >= listTotalPages || usersRefreshing
              }
              onClick={() =>
                setUserPage((p) => Math.min(listTotalPages, p + 1))
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 md:mb-6 p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm md:text-base">
            <AlertCircle size={18} className="md:w-5 md:h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="relative flex-1 flex flex-col min-h-0">
          {usersRefreshing && (
            <div
              className="absolute inset-0 z-20 bg-slate-950/40 flex items-center justify-center pointer-events-none rounded-xl"
              aria-hidden
            >
              <Loader2
                className="animate-spin text-indigo-400"
                size={36}
                aria-label="Updating list"
              />
            </div>
          )}

        {/* Desktop Table View */}
        <div
          className="hidden lg:flex bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex-1 min-h-0 flex-col"
          style={{ maxHeight: "calc(100vh - 300px)" }}
        >
          <div
            className="overflow-y-auto overflow-x-auto"
            style={{ maxHeight: "calc(100vh - 300px)" }}
          >
            <table className="w-full">
              <thead className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">
                    User
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">
                    Email
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">
                    Role
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">
                    Blocked
                  </th>
                  <th className="px-4 lg:px-6 py-3 lg:py-4 text-left text-xs lg:text-sm font-semibold text-slate-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div className="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                          <Users
                            size={16}
                            className="lg:w-5 lg:h-5 text-white"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm lg:text-base truncate">
                            {user.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4 text-slate-300 text-sm lg:text-base">
                      <span className="truncate block max-w-[200px] lg:max-w-none">
                        {user.email}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-3 lg:py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-purple-500/20 text-purple-400"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {user.role}
                      </span>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleBlockToggle(user)}
                          disabled={updating === user.id}
                          className={`px-2 lg:px-3 py-1 rounded text-xs lg:text-sm font-medium transition-colors ${
                            user.isBlocked
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-red-600 hover:bg-red-700 text-white"
                          } disabled:opacity-50`}
                        >
                          {updating === user.id ? (
                            <Loader2
                              className="animate-spin lg:w-4 lg:h-4"
                              size={14}
                            />
                          ) : user.isBlocked ? (
                            "Unblock"
                          ) : (
                            "Block"
                          )}
                        </button>
                        <button
                          onClick={() => openRoleModal(user)}
                          disabled={
                            updating === user.id || user.id === currentUser?.id
                          }
                          className="px-2 lg:px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs lg:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title={
                            user.id === currentUser?.id
                              ? "You cannot change your own role here"
                              : "Change role (user / admin)"
                          }
                        >
                          {updating === user.id ? (
                            <Loader2
                              className="animate-spin lg:w-4 lg:h-4"
                              size={14}
                            />
                          ) : (
                            <span className="flex items-center gap-1">
                              <UserCog size={12} className="lg:w-3 lg:h-3" />
                              <span className="hidden lg:inline">Role</span>
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleResetPassword(user)}
                          disabled={updating === user.id}
                          className="px-2 lg:px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs lg:text-sm font-medium disabled:opacity-50 transition-colors"
                          title="Reset password - user will need to set new password on next login"
                        >
                          {updating === user.id ? (
                            <Loader2
                              className="animate-spin lg:w-4 lg:h-4"
                              size={14}
                            />
                          ) : (
                            <span className="flex items-center gap-1">
                              <KeyRound size={12} className="lg:w-3 lg:h-3" />
                              <span className="hidden lg:inline">Reset PW</span>
                              <span className="lg:hidden">Reset</span>
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={
                            updating === user.id || user.id === currentUser?.id
                          }
                          className="px-2 lg:px-3 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-xs lg:text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title={
                            user.id === currentUser?.id
                              ? "You cannot delete your own account"
                              : "Delete user account"
                          }
                        >
                          {updating === user.id ? (
                            <Loader2
                              className="animate-spin lg:w-4 lg:h-4"
                              size={14}
                            />
                          ) : (
                            <span className="flex items-center gap-1">
                              <Trash2 size={12} className="lg:w-3 lg:h-3" />
                              <span className="hidden lg:inline">Delete</span>
                              <span className="lg:hidden">Del</span>
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4 overflow-y-auto flex-1 min-h-0 pb-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-4"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                    <Users size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {user.email}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-slate-700 text-slate-300"
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
              </div>

              <div className="mb-4">
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

              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-800">
                <button
                  onClick={() => handleBlockToggle(user)}
                  disabled={updating === user.id}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex-1 min-w-[80px] ${
                    user.isBlocked
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  } disabled:opacity-50`}
                >
                  {updating === user.id ? (
                    <Loader2 className="animate-spin mx-auto" size={14} />
                  ) : user.isBlocked ? (
                    "Unblock"
                  ) : (
                    "Block"
                  )}
                </button>
                <button
                  onClick={() => openRoleModal(user)}
                  disabled={
                    updating === user.id || user.id === currentUser?.id
                  }
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1 min-w-[80px] flex items-center justify-center gap-1.5"
                  title={
                    user.id === currentUser?.id
                      ? "You cannot change your own role here"
                      : "Change role"
                  }
                >
                  {updating === user.id ? (
                    <Loader2 className="animate-spin mx-auto" size={14} />
                  ) : (
                    <>
                      <UserCog size={12} />
                      <span>Role</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleResetPassword(user)}
                  disabled={updating === user.id}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs font-medium disabled:opacity-50 transition-colors flex-1 min-w-[80px] flex items-center justify-center gap-1.5"
                >
                  {updating === user.id ? (
                    <Loader2 className="animate-spin mx-auto" size={14} />
                  ) : (
                    <>
                      <KeyRound size={12} />
                      <span>Reset PW</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteUser(user)}
                  disabled={updating === user.id || user.id === currentUser?.id}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-1 min-w-[80px] flex items-center justify-center gap-1.5"
                >
                  {updating === user.id ? (
                    <Loader2 className="animate-spin mx-auto" size={14} />
                  ) : (
                    <>
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
        </div>

        {users.length === 0 &&
          !usersBootstrapping &&
          !usersRefreshing && (
          <div className="text-center py-12">
            <Users size={48} className="text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {debouncedSearchQuery.trim()
                ? "No users found matching your search"
                : "No users found"}
            </p>
            {debouncedSearchQuery.trim() && (
              <button
                type="button"
                onClick={() => {
                  setSearchBarKey((k) => k + 1);
                  setDebouncedSearchQuery("");
                  setUserPage(1);
                }}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Modal de confirmação de Block/Unblock */}
      {blockConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 md:p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 ${
                  blockConfirm.isBlocked
                    ? "bg-green-500/20 border-green-500/30"
                    : "bg-red-500/20 border-red-500/30"
                }`}
              >
                <Ban
                  size={24}
                  className={
                    blockConfirm.isBlocked ? "text-green-400" : "text-red-400"
                  }
                />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-white">
                  {blockConfirm.isBlocked ? "Unblock User" : "Block User"}
                </h3>
                <p className="text-sm text-slate-400">Confirm action</p>
              </div>
            </div>
            <p className="text-sm md:text-base text-slate-300 mb-4 md:mb-6">
              Are you sure you want to{" "}
              {blockConfirm.isBlocked ? "unblock" : "block"}{" "}
              <span className="font-semibold text-white">
                {blockConfirm.userName}
              </span>
              ?
              {!blockConfirm.isBlocked && (
                <span className="block mt-2 text-red-400 text-xs md:text-sm">
                  This will prevent the user from accessing the platform.
                </span>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={cancelBlockToggle}
                disabled={updating === blockConfirm.userId}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmBlockToggle}
                disabled={updating === blockConfirm.userId}
                className={`flex-1 px-4 py-2 rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base ${
                  blockConfirm.isBlocked
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {updating === blockConfirm.userId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="hidden sm:inline">Updating...</span>
                    <span className="sm:hidden">...</span>
                  </span>
                ) : blockConfirm.isBlocked ? (
                  "Unblock"
                ) : (
                  "Block"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de Delete User */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 md:p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30 shrink-0">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-white">
                  Delete User Account
                </h3>
                <p className="text-sm text-slate-400">Confirm action</p>
              </div>
            </div>
            <p className="text-sm md:text-base text-slate-300 mb-4 md:mb-6">
              Are you sure you want to permanently delete the account for{" "}
              <span className="font-semibold text-white">
                {deleteConfirm.userName}
              </span>{" "}
              ({deleteConfirm.userEmail})?
              <span className="block mt-2 text-red-400 text-xs md:text-sm font-semibold">
                ⚠️ This action cannot be undone. All user data and conversations
                will be permanently deleted.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={cancelDeleteUser}
                disabled={updating === deleteConfirm.userId}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={updating === deleteConfirm.userId}
                className="flex-1 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                {updating === deleteConfirm.userId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="hidden sm:inline">Deleting...</span>
                    <span className="sm:hidden">...</span>
                  </span>
                ) : (
                  "Delete Account"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: alterar role */}
      {roleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 md:p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center border border-purple-500/30 shrink-0">
                <UserCog size={24} className="text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-white">
                  Change role
                </h3>
                <p className="text-sm text-slate-400">User: {roleModal.userName}</p>
              </div>
            </div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Role
            </label>
            <select
              value={roleModal.selectedRole}
              onChange={(e) =>
                setRoleModal({
                  ...roleModal,
                  selectedRole: e.target.value as "user" | "admin",
                })
              }
              disabled={updating === roleModal.userId}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={cancelRoleChange}
                disabled={updating === roleModal.userId}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRoleChange}
                disabled={updating === roleModal.userId}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                {updating === roleModal.userId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    Saving...
                  </span>
                ) : (
                  "Save role"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de Reset Password */}
      {resetPasswordConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 md:p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center border border-yellow-500/30 shrink-0">
                <KeyRound size={24} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-white">
                  Reset Password
                </h3>
                <p className="text-sm text-slate-400">Confirm action</p>
              </div>
            </div>
            <p className="text-sm md:text-base text-slate-300 mb-4 md:mb-6">
              Are you sure you want to reset the password for{" "}
              <span className="font-semibold text-white">
                {resetPasswordConfirm.userName}
              </span>
              ?
              <span className="block mt-2 text-yellow-400 text-xs md:text-sm">
                The user will be required to set a new password on their next
                login attempt.
              </span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={cancelResetPassword}
                disabled={updating === resetPasswordConfirm.userId}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetPassword}
                disabled={updating === resetPasswordConfirm.userId}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm md:text-base"
              >
                {updating === resetPasswordConfirm.userId ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="hidden sm:inline">Resetting...</span>
                    <span className="sm:hidden">...</span>
                  </span>
                ) : (
                  "Reset Password"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
