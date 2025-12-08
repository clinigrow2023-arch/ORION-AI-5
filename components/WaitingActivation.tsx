import React, { useState } from "react";
import { Clock, Mail, LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../lib/auth";

const WaitingActivation: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const token = authService.getToken();
      if (!token) {
        setRefreshing(false);
        return;
      }

      // Fazer verificação direta quando usuário clicar
      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const response = await fetch(getApiEndpoint("auth-verify"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const updatedUser = data.user;

        // IMPORTANTE: Atualizar localStorage ANTES de atualizar o estado
        // Isso garante que quando a página recarregar, o checkAuth encontre os dados corretos
        localStorage.setItem("user", JSON.stringify(updatedUser));

        // Se usuário foi ativado, atualizar estado do contexto e recarregar
        if (updatedUser.isActive) {
          // Atualizar estado do contexto através do refreshUser
          await refreshUser();
          // Recarregar página para mostrar interface principal
          window.location.reload();
        } else {
          // Ainda não foi ativado - atualizar estado local
          await refreshUser();
        }
      } else if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        if (data.blocked) {
          // Usuário bloqueado - fazer logout
          authService.logout();
          alert(
            "Sua conta foi bloqueada. Entre em contato com um administrador."
          );
          window.location.reload();
        } else if (data.notActive || data.expired) {
          // Ainda sem acesso ativo - atualizar estado para refletir status atual
          await refreshUser();
        }
      }
    } catch (error) {
      console.error("Failed to verify activation:", error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
        <div className="w-20 h-20 bg-indigo-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10 text-indigo-400 animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          {user?.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()
            ? "Acesso Expirado"
            : "Aguardando Ativação"}
        </h1>

        <p className="text-slate-400 mb-6 leading-relaxed">
          {user?.accessExpiresAt && new Date(user.accessExpiresAt) < new Date()
            ? "Seu acesso expirou. Entre em contato com um administrador para renovar seu acesso."
            : "Seu acesso ainda não foi liberado. Entre em contato com um administrador para liberar seu acesso ao chat."}
        </p>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
          <div className="flex items-start gap-3 text-left">
            <Mail className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">
                Email cadastrado:
              </p>
              <p className="text-sm text-slate-400 break-all">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>Verificar Ativação</span>
              </>
            )}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-6">
          Você receberá acesso assim que um administrador liberar sua conta.
        </p>
      </div>
    </div>
  );
};

export default WaitingActivation;
