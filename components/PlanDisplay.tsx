import React, { useState, useEffect, useCallback, useRef } from "react";
import { ActionPlan } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../lib/auth";
import { getActiveConversationId } from "../lib/active-conversation";
import {
  type ConversationDetail,
  type ConversationSummary,
  fetchConversationDetail,
  fetchConversationsSummary,
  invalidateConversationsCache,
} from "../lib/conversations-client";
import {
  startPlanGeneration,
  getPlanJob,
  clearPlanJob,
  requestPlanNotificationPermission,
  subscribePlanReady,
} from "../services/planJobService";
import { friendlyPlanErrorMessage } from "../lib/plan-utils";
import {
  Target,
  Clock,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
  BrainCircuit,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Trash2,
  Bell,
} from "lucide-react";

interface PlanDisplayProps {
  plan: ActionPlan | null;
  setPlan: (plan: ActionPlan | null) => void;
}

const PlanDisplay: React.FC<PlanDisplayProps> = ({ setPlan }) => {
  const { user } = useAuth();
  const [viewPlan, setViewPlan] = useState<ActionPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [backgroundNote, setBackgroundNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadedConversation, setLoadedConversation] =
    useState<ConversationDetail | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [showConversationSelector, setShowConversationSelector] =
    useState(false);

  const hasAccess = !!user;
  const setPlanRef = useRef(setPlan);
  setPlanRef.current = setPlan;
  const planInitDone = useRef(false);
  const readyJobHandled = useRef<string | null>(null);

  const refreshConversationList = async (force = false) => {
    const list = await fetchConversationsSummary(force);
    if (list.length) setConversations(list);
    return list;
  };

  const loadConversationPlan = useCallback(async (conversationId: string) => {
    const conv = await fetchConversationDetail(conversationId);
    setLoadedConversation(conv);
    const plan = (conv?.actionPlan as ActionPlan | undefined) ?? null;
    if (plan?.steps?.length) {
      setViewPlan(plan);
      setPlanRef.current(plan);
    } else {
      setViewPlan(null);
      setPlanRef.current(null);
    }
    return conv;
  }, []);

  useEffect(() => {
    if (planInitDone.current) return;
    planInitDone.current = true;

    void (async () => {
      const list = await refreshConversationList();
      const active = getActiveConversationId();
      const pick =
        active && list.some((c) => c.id === active) ? active : list[0]?.id;
      if (pick) {
        const staleJob = getPlanJob(pick);
        if (staleJob?.status === "error") {
          clearPlanJob(pick);
          setError(null);
        }
        setSelectedConversationId(pick);
        await loadConversationPlan(pick);
      }
    })();
  }, [loadConversationPlan]);

  const selectConversation = (conversationId: string) => {
    if (conversationId === selectedConversationId) return;
    setSelectedConversationId(conversationId);
    void loadConversationPlan(conversationId);
  };

  useEffect(() => {
    if (!selectedConversationId) return;

    const syncJob = () => {
      const job = getPlanJob(selectedConversationId);
      if (job?.status === "pending") {
        setIsGenerating(true);
        setBackgroundNote(
          "Generating in the background. You can leave this page — we'll notify you when it's ready."
        );
        return;
      }
      if (job?.status === "ready") {
        setIsGenerating(false);
        setBackgroundNote(null);
        if (readyJobHandled.current === selectedConversationId) return;
        readyJobHandled.current = selectedConversationId;
        void loadConversationPlan(selectedConversationId).then(() => {
          clearPlanJob(selectedConversationId);
          readyJobHandled.current = null;
          invalidateConversationsCache(selectedConversationId);
        });
        return;
      }
      if (job?.status === "error") {
        setIsGenerating(false);
        setBackgroundNote(null);
        setError(
          friendlyPlanErrorMessage(job.error || "Plan generation failed")
        );
      }
    };

    syncJob();
    const interval = setInterval(syncJob, 5000);
    return () => clearInterval(interval);
  }, [selectedConversationId, loadConversationPlan]);

  useEffect(() => {
    return subscribePlanReady((conversationId) => {
      if (conversationId !== selectedConversationId) return;
      void loadConversationPlan(conversationId).then(() => {
        clearPlanJob(conversationId);
        invalidateConversationsCache(conversationId);
      });
      setIsGenerating(false);
      setBackgroundNote(null);
    });
  }, [selectedConversationId, loadConversationPlan]);

  const buildHistoryText = (conv: ConversationDetail | null): string => {
    if (conv?.messages?.length) {
      return conv.messages
        .map(
          (msg) =>
            `${msg.sender === "user" ? "User" : "Orion"}: ${msg.text}`
        )
        .join("\n\n");
    }
    return "";
  };

  const generatePlan = async () => {
    if (!hasAccess || !selectedConversationId) return;

    let conv = loadedConversation;
    conv =
      (await fetchConversationDetail(selectedConversationId, true)) ?? conv;
    if (conv) setLoadedConversation(conv);

    const history = buildHistoryText(conv);
    if (!history.trim()) {
      setError(
        "Please chat with Orion first so we have context for your plan."
      );
      return;
    }

    setError(null);
    setIsGenerating(true);
    setBackgroundNote(
      "Generating in the background. You can leave this page — we'll notify you when it's ready."
    );

    await requestPlanNotificationPermission();
    await refreshConversationList(true);

    startPlanGeneration({
      conversationId: selectedConversationId,
      contextHistory: history,
      onComplete: (newPlan) => {
        setViewPlan(newPlan);
        setPlan(newPlan);
        setIsGenerating(false);
        setBackgroundNote(null);
        invalidateConversationsCache(selectedConversationId);
        void refreshConversationList(true);
        void loadConversationPlan(selectedConversationId);
      },
      onError: (message) => {
        setError(friendlyPlanErrorMessage(message));
        setIsGenerating(false);
        setBackgroundNote(null);
      },
    });
  };

  const deleteSavedPlan = async () => {
    if (!selectedConversationId) return;
    try {
      const token = authService.getToken();
      if (!token) return;
      const { getApiEndpoint } = await import("../lib/api-endpoints");
      await fetch(getApiEndpoint("conversations"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          clearActionPlan: true,
        }),
      });
      clearPlanJob(selectedConversationId);
      setViewPlan(null);
      setPlan(null);
      invalidateConversationsCache(selectedConversationId);
      await loadConversationPlan(selectedConversationId);
      await refreshConversationList(true);
    } catch (e) {
      console.error("Failed to delete plan:", e);
      setError("Could not delete the saved plan.");
    }
  };

  const conversationLabel = (conv: ConversationSummary) => {
    const date = new Date(conv.updatedAt).toLocaleDateString();
    const time = new Date(conv.updatedAt).toLocaleTimeString();
    const planTag = conv.hasActionPlan ? " • plan saved" : "";
    return `Chat ${date} • ${conv.messageCount ?? 0} msgs • ${time}${planTag}`;
  };

  const isValidPlan =
    viewPlan &&
    viewPlan.steps?.length > 0 &&
    viewPlan.messageTemplates?.length >= 3;

  if (!isValidPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 max-w-lg w-full">
          <Target className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">
            Generate Your Strategy
          </h2>
          <p className="text-slate-400 mb-6">
            Orion analyzes one chat at a time. Each conversation can have its
            own saved plan.
          </p>

          {backgroundNote && (
            <div className="mb-4 p-3 bg-indigo-900/30 border border-indigo-700 text-indigo-200 rounded-lg flex items-start gap-2 text-sm text-left">
              <Bell size={16} className="shrink-0 mt-0.5" />
              {backgroundNote}
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-900/30 border border-red-800 text-red-300 rounded-lg flex items-start gap-2 text-sm text-left">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (selectedConversationId) {
                    clearPlanJob(selectedConversationId);
                  }
                }}
                className="shrink-0 text-red-200/80 hover:text-white underline text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {conversations.length > 0 && (
            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Conversation for this plan:
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setShowConversationSelector(!showConversationSelector)
                  }
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-left text-slate-300 flex items-center justify-between hover:border-indigo-500 transition-colors"
                >
                  <span className="text-sm truncate">
                    {selectedConversationId
                      ? conversationLabel(
                          conversations.find(
                            (c) => c.id === selectedConversationId
                          ) || {
                            id: selectedConversationId,
                            createdAt: "",
                            updatedAt: new Date().toISOString(),
                          }
                        )
                      : "Select a conversation"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={
                      showConversationSelector ? "rotate-180 shrink-0" : "shrink-0"
                    }
                  />
                </button>

                {showConversationSelector && (
                  <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {conversations.map((conv) => (
                      <button
                        type="button"
                        key={conv.id}
                        onClick={() => {
                          selectConversation(conv.id);
                          setShowConversationSelector(false);
                          setError(null);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                          selectedConversationId === conv.id
                            ? "bg-indigo-600/20 text-indigo-300"
                            : "text-slate-300"
                        }`}
                      >
                        {conversationLabel(conv)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={generatePlan}
            disabled={isGenerating || !hasAccess || !selectedConversationId}
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <BrainCircuit />
            )}
            {isGenerating
              ? "Generating in background..."
              : "Generate Action Plan"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Plan for:{" "}
          {selectedConversationId
            ? conversationLabel(
                conversations.find((c) => c.id === selectedConversationId) || {
                  id: selectedConversationId,
                  createdAt: "",
                  updatedAt: new Date().toISOString(),
                }
              )
            : "—"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setViewPlan(null);
              setPlan(null);
              setError(null);
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            Generate for another chat
          </button>
          <button
            type="button"
            onClick={deleteSavedPlan}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-800/50 text-red-300 hover:bg-red-900/20 flex items-center gap-1"
          >
            <Trash2 size={14} /> Delete saved plan
          </button>
          <button
            type="button"
            onClick={async () => {
              await deleteSavedPlan();
              await generatePlan();
            }}
            disabled={isGenerating}
            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-600 text-indigo-300 hover:bg-indigo-900/30 disabled:opacity-50"
          >
            Regenerate this chat&apos;s plan
          </button>
        </div>
      </div>

      {backgroundNote && (
        <div className="p-3 bg-indigo-900/30 border border-indigo-700 text-indigo-200 rounded-lg text-sm flex items-center gap-2">
          <Loader2 className="animate-spin w-4 h-4" />
          {backgroundNote}
        </div>
      )}

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Target size={20} /> Diagnostic Analysis
        </h3>
        <p className="text-slate-200 leading-relaxed text-lg">
          {viewPlan.diagnosis}
        </p>
      </section>

      <section>
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock size={24} className="text-indigo-500" /> 3-Step Action Plan
        </h3>
        <div className="grid gap-6 md:grid-cols-3">
          {viewPlan.steps.map((step) => (
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

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <MessageCircle size={24} className="text-indigo-500" /> Strategic
          Communication
        </h3>
        <div className="space-y-4">
          {viewPlan.messageTemplates.map((msg, idx) => (
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
                &quot;{msg.text}&quot;
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-slate-900/50 border border-green-900/30 rounded-2xl p-6">
          <h3 className="text-green-400 font-bold mb-4 flex items-center gap-2">
            <ShieldCheck size={20} /> Essential Actions
          </h3>
          <ul className="space-y-3">
            {viewPlan.dos.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-slate-300 text-sm"
              >
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 shrink-0" />
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
            {viewPlan.donts.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-slate-300 text-sm"
              >
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
          <h4 className="text-indigo-300 font-semibold mb-2">
            Strategic Distancing
          </h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            {viewPlan.distancingStrategy}
          </p>
        </div>
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
          <h4 className="text-indigo-300 font-semibold mb-2">Secret Signals</h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            {viewPlan.neurologicalTriggers}
          </p>
        </div>
      </section>
    </div>
  );
};

export default PlanDisplay;
