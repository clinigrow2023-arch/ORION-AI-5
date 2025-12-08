import React, { useState, useEffect } from "react";
import { ActionPlan } from "../types";
import { geminiService } from "../services/geminiService";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../lib/auth";
import {
  Target,
  Clock,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  BrainCircuit,
  Loader2,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
} from "lucide-react";

interface PlanDisplayProps {
  plan: ActionPlan | null;
  setPlan: (plan: ActionPlan) => void;
}

interface Conversation {
  id: string;
  messages: Array<{ text: string; sender: string; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
}

const PlanDisplay: React.FC<PlanDisplayProps> = ({ plan, setPlan }) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [showConversationSelector, setShowConversationSelector] =
    useState(false);

  // Usuários podem usar a IA imediatamente após cadastro (sem necessidade de liberação)
  const hasAccess = !!user;

  // Carregar conversas ao montar
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const token = authService.getToken();
        if (!token) return;

        const { getApiEndpoint } = await import("../lib/api-endpoints");
        const response = await fetch(getApiEndpoint("conversations"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.conversations && data.conversations.length > 0) {
            setConversations(data.conversations);
            // Selecionar primeira conversa por padrão
            if (!selectedConversationId) {
              setSelectedConversationId(data.conversations[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };

    loadConversations();
  }, []);

  const getSelectedConversationHistory = (): string => {
    if (!selectedConversationId) {
      // Fallback para histórico do geminiService
      return geminiService.getHistoryAsString() || "";
    }

    const selectedConv = conversations.find(
      (c) => c.id === selectedConversationId
    );
    if (
      !selectedConv ||
      !selectedConv.messages ||
      selectedConv.messages.length === 0
    ) {
      return geminiService.getHistoryAsString() || "";
    }

    // Converter mensagens da conversa para string de histórico
    return selectedConv.messages
      .map((msg) => `${msg.sender === "user" ? "User" : "Orion"}: ${msg.text}`)
      .join("\n\n");
  };

  const generatePlan = async () => {
    // Verificar acesso antes de gerar plano
    if (!hasAccess) {
      setError(
        "Your account access has not been granted or has expired. Please contact an administrator."
      );
      return;
    }

    const history = getSelectedConversationHistory();
    if (!history) {
      setError(
        "Please select a conversation or chat with Orion first to provide context about your situation."
      );
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const newPlan = await geminiService.generateFormalPlan(history);

      // Validar que o plano recebido está completo
      if (
        !newPlan ||
        !newPlan.steps ||
        !Array.isArray(newPlan.steps) ||
        newPlan.steps.length === 0
      ) {
        setError(
          "The generated plan is incomplete. Please try again or provide more details in the chat."
        );
        return;
      }

      setPlan(newPlan);
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        "Failed to generate plan. Make sure you have provided enough details in the chat.";
      setError(errorMessage);
      console.error("Plan generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Validar se o plano está completo antes de renderizar
  const isValidPlan =
    plan &&
    plan.steps &&
    Array.isArray(plan.steps) &&
    plan.steps.length > 0 &&
    plan.messageTemplates &&
    Array.isArray(plan.messageTemplates) &&
    plan.messageTemplates.length > 0;

  if (!plan || !isValidPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 max-w-lg">
          <Target className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">
            Generate Your Strategy
          </h2>
          <p className="text-slate-400 mb-8">
            Orion will analyze your chat history to create a custom 3-step
            reconciliation plan, including specific texts and psychological
            triggers.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-900/30 border border-red-800 text-red-300 rounded-lg flex items-center gap-2 text-sm text-left">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Conversation Selector */}
          {conversations.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select conversation to use as context:
              </label>
              <div className="relative">
                <button
                  onClick={() =>
                    setShowConversationSelector(!showConversationSelector)
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-left text-slate-300 flex items-center justify-between hover:border-indigo-500 transition-colors"
                >
                  <span>
                    {selectedConversationId
                      ? `Chat from ${new Date(
                          conversations.find(
                            (c) => c.id === selectedConversationId
                          )?.updatedAt || ""
                        ).toLocaleDateString()}`
                      : "Select a conversation"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={showConversationSelector ? "rotate-180" : ""}
                  />
                </button>

                {showConversationSelector && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => {
                          setSelectedConversationId(conv.id);
                          setShowConversationSelector(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                          selectedConversationId === conv.id
                            ? "bg-indigo-600/20 text-indigo-300"
                            : "text-slate-300"
                        }`}
                      >
                        <div className="font-medium">
                          Chat from{" "}
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-500">
                          {conv.messages?.length || 0} messages •{" "}
                          {new Date(conv.updatedAt).toLocaleTimeString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={generatePlan}
            disabled={isGenerating || !hasAccess || !selectedConversationId}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <BrainCircuit />
            )}
            {isGenerating ? "Synthesizing Strategy..." : "Generate Action Plan"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 space-y-8">
      {/* Diagnosis Section */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Target size={20} /> Diagnostic Analysis
        </h3>
        <p className="text-slate-200 leading-relaxed text-lg">
          {plan.diagnosis}
        </p>
      </section>

      {/* 3-Step Plan */}
      <section>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={24} className="text-indigo-500" /> 3-Step Action Plan
        </h3>
        <div className="grid gap-6 md:grid-cols-3">
          {plan.steps.map((step) => (
            <div
              key={step.stepNumber}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
            >
              <div className="absolute -right-4 -top-4 text-slate-800 text-9xl font-bold opacity-20 group-hover:text-indigo-900 transition-colors select-none">
                {step.stepNumber}
              </div>
              <div className="relative z-10">
                <div className="inline-block px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-xs font-bold mb-3">
                  {step.duration}
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {step.title}
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Message Templates */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <MessageCircle size={24} className="text-indigo-500" /> Strategic
          Communication
        </h3>
        <div className="space-y-4">
          {plan.messageTemplates.map((msg, idx) => (
            <div
              key={idx}
              className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-indigo-300 font-medium text-sm">
                  {msg.situation}
                </span>
                <span className="text-slate-500 text-xs uppercase tracking-wide">
                  {msg.timing}
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border-l-4 border-indigo-500 text-slate-200 font-mono text-sm relative">
                "{msg.text}"
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dos and Donts */}
      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-slate-900/50 border border-green-900/30 rounded-2xl p-6">
          <h3 className="text-green-400 font-bold mb-4 flex items-center gap-2">
            <ShieldCheck size={20} /> Essential Actions
          </h3>
          <ul className="space-y-3">
            {plan.dos.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-slate-300 text-sm"
              >
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-slate-900/50 border border-red-900/30 rounded-2xl p-6">
          <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
            <ShieldAlert size={20} /> Critical Mistakes to Avoid
          </h3>
          <ul className="space-y-3">
            {plan.donts.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-slate-300 text-sm"
              >
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Advanced Strategy */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
          <h4 className="text-indigo-300 font-semibold mb-2">
            Strategic Distancing
          </h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            {plan.distancingStrategy}
          </p>
        </div>
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
          <h4 className="text-indigo-300 font-semibold mb-2">Secret Signals</h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            {plan.neurologicalTriggers}
          </p>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => setPlan(null)} // Reset to allow re-generation
          className="text-xs text-slate-500 hover:text-slate-300 underline"
        >
          Discard and regenerate plan
        </button>
      </div>
    </div>
  );
};

export default PlanDisplay;
