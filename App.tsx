import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatInterface from "./components/ChatInterface";
import PlanDisplay from "./components/PlanDisplay";
import GuideView from "./components/GuideView";
import SupportView from "./components/SupportView";
import AdminDashboard from "./components/AdminDashboard";
import Auth from "./components/Auth";
import WaitingActivation from "./components/WaitingActivation";
import SetNewPassword from "./components/SetNewPassword";
import { useAuth } from "./contexts/AuthContext";
import { ViewState, Message, ActionPlan, Sender } from "./types";
import { Menu, X, Loader2 } from "lucide-react";
import { geminiService } from "./services/geminiService";

const App: React.FC = () => {
  const { isAuthenticated, loading, isAdmin, user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<ViewState | "admin">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Não fazer logout automático se usuário estiver bloqueado ou expirado
  // Usuário permanece logado mas sem acesso ao chat (já está bloqueado no ChatInterface)

  const addMessage = (msg: Message) => {
    setMessages((prev) => {
      // Verificar se a mensagem já existe (evitar duplicação)
      const exists = prev.some((m) => m.id === msg.id);
      if (exists) {
        return prev;
      }
      return [...prev, msg];
    });
  };

  const resetChat = () => {
    setMessages([]);
    setPlan(null);
    // Limpar histórico do geminiService
    geminiService.clearHistory();
  };

  const renderContent = () => {
    switch (currentView) {
      case "admin":
        return <AdminDashboard />;
      case "chat":
        return (
          <ChatInterface
            messages={messages}
            addMessage={addMessage}
            onResetChat={resetChat}
          />
        );
      case "plan":
        return <PlanDisplay plan={plan} setPlan={setPlan} />;
      case "guide":
        return <GuideView />;
      case "support":
        return <SupportView />;
      default:
        return (
          <ChatInterface
            messages={messages}
            addMessage={addMessage}
            onResetChat={resetChat}
          />
        );
    }
  };

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center">
        <div className="text-center">
          <Loader2
            className="animate-spin text-indigo-500 mx-auto mb-4"
            size={48}
          />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Mostrar tela de autenticação se não estiver autenticado
  if (!isAuthenticated) {
    return <Auth />;
  }

  // Verificar se precisa definir nova senha após reset
  if (user && user.passwordResetRequired) {
    return <SetNewPassword onComplete={() => {}} />;
  }

  // IMPORTANTE: Admin sempre tem acesso ilimitado
  // Não verifica isActive ou accessExpiresAt para admin
  // Apenas usuários comuns precisam de ativação e têm expiração de acesso

  // LÓGICA DE ACESSO:
  // - isBlocked: logout automático (não chega aqui)
  // - isActive: false = acesso revogado (permanece logado, não pode usar chat)
  // - accessExpiresAt expirado = acesso expirado (permanece logado, não pode usar chat)
  // - WaitingActivation: APENAS para novos usuários que nunca foram aprovados (accessExpiresAt === null)

  // Mostrar tela de aguardando ativação APENAS se:
  // 1. Usuário não tem acesso ativo (isActive: false)
  // 2. E nunca foi aprovado antes (accessExpiresAt === null) = novo cadastro
  // Se já foi aprovado uma vez, mesmo que acesso seja revogado, não mostra mais essa tela
  if (user && user.role !== "admin") {
    // Novo usuário aguardando primeira aprovação
    if (!user.isActive && !user.accessExpiresAt) {
      return <WaitingActivation />;
    }
    // Acesso expirado ou revogado - não mostrar WaitingActivation (usuário já foi aprovado antes)
    // Usuário pode ver interface mas não pode usar chat (já está bloqueado no ChatInterface)
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Hidden on mobile unless toggled */}
      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <Sidebar
          currentView={currentView}
          setView={(view) => {
            setCurrentView(view);
            setIsMobileMenuOpen(false);
          }}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full relative w-full pt-16 md:pt-0">{renderContent()}</main>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
