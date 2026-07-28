import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatInterface from "./components/ChatInterface";
import PlanDisplay from "./components/PlanDisplay";
import GuideView from "./components/GuideView";
import SupportView from "./components/SupportView";
import AdminDashboard from "./components/AdminDashboard";
import Auth from "./components/Auth";
import SetNewPassword from "./components/SetNewPassword";
import { useAuth } from "./contexts/AuthContext";
import { useTranslation } from "./contexts/I18nContext";
import { ViewState, Message, ActionPlan, Sender } from "./types";
import { Menu, X, Loader2 } from "lucide-react";
import { chatService } from "./services/chatService";
import {
  getAnyPendingPlanJob,
  getReadyPlanJob,
  subscribePlanReady,
  subscribePlanOpen,
} from "./services/planJobService";
import { fetchConversationsSummary } from "./lib/conversations-client";

const App: React.FC = () => {
  const { isAuthenticated, loading, isAdmin, user, logout } = useAuth();
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<ViewState | "admin">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [planNotice, setPlanNotice] = useState<"pending" | "ready" | null>(null);
  const [planReadyConversationId, setPlanReadyConversationId] = useState<
    string | null
  >(null);
  const [planOpenRequest, setPlanOpenRequest] = useState<{
    conversationId: string;
    display: boolean;
  } | null>(null);
  const [hasSavedPlan, setHasSavedPlan] = useState(false);

  const openPlanForConversation = useCallback(
    (conversationId: string, display = true) => {
      setPlanOpenRequest({ conversationId, display });
      setCurrentView("plan");
      setPlanNotice(null);
      setPlanReadyConversationId(null);
    },
    []
  );

  useEffect(() => {
    const refresh = () => {
      if (getAnyPendingPlanJob()) {
        setPlanNotice("pending");
        return;
      }
      const ready = getReadyPlanJob();
      if (ready) {
        setPlanNotice("ready");
        setPlanReadyConversationId(ready.conversationId);
      }
    };
    refresh();
    const id = setInterval(refresh, 2000);
    const unsubReady = subscribePlanReady((conversationId) => {
      setPlanNotice("ready");
      setPlanReadyConversationId(conversationId);
    });
    const unsubOpen = subscribePlanOpen((conversationId) => {
      openPlanForConversation(conversationId, true);
    });
    return () => {
      clearInterval(id);
      unsubReady();
      unsubOpen();
    };
  }, [openPlanForConversation]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchConversationsSummary(true).then((list) => {
      setHasSavedPlan(list.some((c) => c.hasActionPlan));
    });
  }, [isAuthenticated, currentView, plan, planNotice]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!getAnyPendingPlanJob()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [planNotice]);

  useEffect(() => {
    if (currentView === "admin" && !isAdmin) {
      setCurrentView("chat");
    }
  }, [currentView, isAdmin]);

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
    // Limpar histórico do chatService
    chatService.clearHistory();
  };

  const applyPlan = useCallback((p: ActionPlan | null) => {
    setPlan(p);
    if (p) setPlanNotice(null);
  }, []);

  const renderContent = () => {
    switch (currentView) {
      case "admin":
        if (!isAdmin) {
          return (
            <ChatInterface
              messages={messages}
              addMessage={addMessage}
              onResetChat={resetChat}
            />
          );
        }
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
        return (
          <PlanDisplay
            plan={plan}
            setPlan={applyPlan}
            openPlanRequest={planOpenRequest}
            onOpenPlanRequestHandled={() => setPlanOpenRequest(null)}
          />
        );
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
          <p className="text-slate-400">{t("app.loading")}</p>
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
  // Usuários comuns podem usar a IA imediatamente após cadastro (sem necessidade de liberação)
  // Apenas usuários bloqueados não podem usar o sistema

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-700 hover:bg-slate-700 transition-colors"
          aria-label={t("app.toggleMenu")}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Hidden on mobile unless toggled */}
      <div
        className={`
        fixed inset-y-0 left-0 z-40 w-[min(100%,19rem)] md:w-72 bg-slate-900 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <Sidebar
          currentView={currentView}
          planNotice={planNotice}
          hasSavedPlan={hasSavedPlan}
          onOpenReadyPlan={() => {
            const id =
              planReadyConversationId ?? getReadyPlanJob()?.conversationId;
            if (id) openPlanForConversation(id, true);
            else setCurrentView("plan");
          }}
          setView={(view) => {
            setCurrentView(view);
            setIsMobileMenuOpen(false);
          }}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full relative w-full pt-16 md:pt-0">
        {renderContent()}
      </main>

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
