import React, { useState, useEffect, useCallback, useRef } from "react";
import { ActionPlan } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../contexts/I18nContext";
import { apiFetch } from "../lib/api-endpoints";
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
  deriveConversationPreview,
  formatConversationLabel,
  formatConversationSubtitle,
  formatConversationTitle,
} from "../lib/conversation-label";
import {
  startPlanGeneration,
  getPlanJob,
  getAnyPendingPlanJob,
  clearPlanJob,
  requestPlanNotificationPermission,
  subscribePlanReady,
} from "../services/planJobService";
import { planErrorMessageKey, type PlanErrorCode } from "../lib/plan-utils";
import ConfirmModal from "./ConfirmModal";
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
  FileText,
} from "lucide-react";

interface PlanDisplayProps {
  plan: ActionPlan | null;
  setPlan: (plan: ActionPlan | null) => void;
  openPlanRequest?: { conversationId: string; display: boolean } | null;
  onOpenPlanRequestHandled?: () => void;
}

const PlanDisplay: React.FC<PlanDisplayProps> = ({
  setPlan,
  openPlanRequest,
  onOpenPlanRequestHandled,
}) => {
  const { user } = useAuth();
  const { t } = useI18n();
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
  const [confirmAction, setConfirmAction] = useState<
    "delete-plan" | "regenerate-plan" | null
  >(null);
  const [planReadyToOpen, setPlanReadyToOpen] = useState(false);

  const hasAccess = !!user;
  const setPlanRef = useRef(setPlan);
  setPlanRef.current = setPlan;
  const planInitDone = useRef(false);
  const readyJobHandled = useRef<string | null>(null);
  const generateLock = useRef(false);

  /** Job errors are persisted as codes, so the text follows the current language. */
  const planErrorText = (
    code: PlanErrorCode | undefined,
    fallback: string | undefined
  ): string => {
    if (!code || code === "unknown") {
      return fallback?.trim() || t("plan.errors.failed");
    }
    return t(planErrorMessageKey(code));
  };

  const refreshConversationList = async (force = false) => {
    const list = await fetchConversationsSummary(force);
    if (list.length) setConversations(list);
    return list;
  };

  const loadConversationPlan = useCallback(
    async (conversationId: string, options?: { displayPlan?: boolean }) => {
      const conv = await fetchConversationDetail(conversationId);
      setLoadedConversation(conv);
      const plan = (conv?.actionPlan as ActionPlan | undefined) ?? null;
      const valid = !!(plan?.steps?.length && plan.messageTemplates?.length >= 3);

      if (options?.displayPlan && valid && plan) {
        setViewPlan(plan);
        setPlanRef.current(plan);
        setPlanReadyToOpen(false);
      } else if (!options?.displayPlan) {
        setViewPlan(null);
        setPlanRef.current(null);
        setPlanReadyToOpen(valid);
      } else if (!valid) {
        setViewPlan(null);
        setPlanRef.current(null);
        setPlanReadyToOpen(false);
      }
      return conv;
    },
    []
  );

  const openSavedPlan = useCallback(
    async (conversationId?: string) => {
      const id = conversationId ?? selectedConversationId;
      if (!id) return;
      setSelectedConversationId(id);
      await loadConversationPlan(id, { displayPlan: true });
    },
    [selectedConversationId, loadConversationPlan]
  );

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

  useEffect(() => {
    if (!openPlanRequest?.conversationId) return;
    const { conversationId, display } = openPlanRequest;
    setSelectedConversationId(conversationId);
    void loadConversationPlan(conversationId, { displayPlan: display }).then(
      () => {
        if (display) {
          clearPlanJob(conversationId);
          setPlanReadyToOpen(false);
        }
        invalidateConversationsCache(conversationId);
        onOpenPlanRequestHandled?.();
      }
    );
  }, [
    openPlanRequest,
    loadConversationPlan,
    onOpenPlanRequestHandled,
  ]);

  const selectConversation = (conversationId: string) => {
    if (conversationId === selectedConversationId) return;
    setSelectedConversationId(conversationId);
    setPlanReadyToOpen(false);
    setViewPlan(null);
    setPlan(null);
    void loadConversationPlan(conversationId);
  };

  useEffect(() => {
    if (!selectedConversationId) return;

    const syncJob = () => {
      const job = getPlanJob(selectedConversationId);
      if (job?.status === "pending") {
        setIsGenerating(true);
        setBackgroundNote(t("plan.background.generating"));
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
          setPlanReadyToOpen(true);
          invalidateConversationsCache(selectedConversationId);
        });
        return;
      }
      if (job?.status === "error") {
        setIsGenerating(false);
        setBackgroundNote(null);
        setError(planErrorText(job.errorCode, job.error));
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
        setPlanReadyToOpen(true);
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

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isGenerating && !getAnyPendingPlanJob()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isGenerating]);

  const generatePlan = async () => {
    if (!hasAccess || !selectedConversationId) return;
    if (generateLock.current) return;

    const existingJob = getPlanJob(selectedConversationId);
    if (
      existingJob?.status === "pending" &&
      Date.now() - existingJob.startedAt < 15 * 60 * 1000
    ) {
      setIsGenerating(true);
      setBackgroundNote(t("plan.background.alreadyRunning"));
      return;
    }

    let conv = loadedConversation;
    conv =
      (await fetchConversationDetail(selectedConversationId, true)) ?? conv;
    if (conv) setLoadedConversation(conv);

    const history = buildHistoryText(conv);
    if (!history.trim()) {
      setError(t("plan.errors.noContext"));
      return;
    }

    setError(null);
    setPlanReadyToOpen(false);
    setViewPlan(null);
    setPlan(null);
    setIsGenerating(true);
    generateLock.current = true;
    setBackgroundNote(t("plan.background.generating"));

    await requestPlanNotificationPermission();
    await refreshConversationList(true);

    const previewTitle =
      conv?.preview ??
      (conv?.messages?.length
        ? deriveConversationPreview(conv.messages)
        : undefined);

    const started = startPlanGeneration({
      conversationId: selectedConversationId,
      contextHistory: history,
      previewTitle,
      onComplete: () => {
        generateLock.current = false;
        setIsGenerating(false);
        setBackgroundNote(null);
        setPlanReadyToOpen(true);
        invalidateConversationsCache(selectedConversationId);
        void refreshConversationList(true);
        void loadConversationPlan(selectedConversationId);
      },
      onError: (message) => {
        generateLock.current = false;
        setError(message);
        setIsGenerating(false);
        setBackgroundNote(null);
      },
    });

    if (!started) {
      generateLock.current = false;
      setIsGenerating(true);
      setBackgroundNote(t("plan.background.alreadyRunning"));
    }
  };

  const deleteSavedPlan = async () => {
    if (!selectedConversationId) return;
    try {
      const token = authService.getToken();
      if (!token) return;
      const response = await apiFetch("conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedConversationId,
          clearActionPlan: true,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error || t("plan.errors.deleteFailed"));
      }

      clearPlanJob(selectedConversationId);
      setViewPlan(null);
      setPlan(null);
      setPlanReadyToOpen(false);
      invalidateConversationsCache(selectedConversationId);
      await loadConversationPlan(selectedConversationId);
      await refreshConversationList(true);
    } catch (e) {
      console.error("Failed to delete plan:", e);
      setError(e instanceof Error ? e.message : t("plan.errors.deleteFailed"));
    }
  };

  const runRegeneratePlan = async () => {
    if (!selectedConversationId) return;
    setViewPlan(null);
    setPlan(null);
    setError(null);
    clearPlanJob(selectedConversationId);
    invalidateConversationsCache(selectedConversationId);

    const conv =
      (await fetchConversationDetail(selectedConversationId, true)) ??
      loadedConversation;
    const history = buildHistoryText(conv);
    if (!history.trim()) {
      setError(t("plan.errors.noContext"));
      return;
    }

    setIsGenerating(true);
    setBackgroundNote(t("plan.background.regenerating"));

    generateLock.current = true;
    const previewTitle =
      conv?.preview ??
      (conv?.messages?.length
        ? deriveConversationPreview(conv.messages)
        : undefined);
    const started = startPlanGeneration({
      conversationId: selectedConversationId,
      contextHistory: history,
      regenerate: true,
      previewTitle,
      onComplete: () => {
        generateLock.current = false;
        setIsGenerating(false);
        setBackgroundNote(null);
        setPlanReadyToOpen(true);
        invalidateConversationsCache(selectedConversationId);
        void refreshConversationList(true);
        void loadConversationPlan(selectedConversationId);
      },
      onError: (message) => {
        generateLock.current = false;
        setError(message);
        setIsGenerating(false);
        setBackgroundNote(null);
      },
    });
    if (!started) {
      generateLock.current = false;
      setError(t("plan.background.alreadyRunning"));
      setIsGenerating(false);
      setBackgroundNote(null);
    }
  };

  const conversationLabel = formatConversationLabel;

  const isValidPlan =
    viewPlan &&
    viewPlan.steps?.length > 0 &&
    viewPlan.messageTemplates?.length >= 3;

  const savedPlanConversation =
    conversations.find(
      (c) => c.hasActionPlan && c.id === selectedConversationId
    ) ?? conversations.find((c) => c.hasActionPlan);

  if (!isValidPlan) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="bg-slate-800/50 p-8 rounded-2xl border border-slate-700 max-w-lg w-full">
          <Target className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">
            {t("plan.empty.title")}
          </h2>
          <p className="text-slate-400 mb-6">{t("plan.empty.description")}</p>

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
                {t("plan.dismiss")}
              </button>
            </div>
          )}

          {planReadyToOpen && !isGenerating && (
            <button
              type="button"
              onClick={() => void openSavedPlan()}
              className="w-full mb-6 py-4 px-4 rounded-xl border-2 border-emerald-500/70 bg-emerald-950/50 hover:bg-emerald-900/40 transition-colors text-left shadow-lg shadow-emerald-900/20"
            >
              <span className="flex items-start gap-3 min-w-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/30 border border-emerald-500/50 shrink-0">
                  <FileText className="text-emerald-300" size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-emerald-200 leading-snug break-words">
                    {t("plan.ready.title")}
                  </span>
                  <span className="block text-xs text-emerald-400/90 mt-0.5 leading-snug break-words">
                    {t("plan.ready.hint")}
                  </span>
                </span>
              </span>
            </button>
          )}

          {savedPlanConversation && !planReadyToOpen && (
            <button
              type="button"
              onClick={() => void openSavedPlan(savedPlanConversation.id)}
              className="w-full mb-6 py-4 px-4 rounded-xl border-2 border-emerald-500/70 bg-emerald-950/50 hover:bg-emerald-900/40 transition-colors text-left shadow-lg shadow-emerald-900/20"
            >
              <span className="flex items-start gap-3 min-w-0">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/30 border border-emerald-500/50 shrink-0">
                  <FileText className="text-emerald-300" size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-emerald-200 leading-snug break-words">
                    {t("plan.saved.open")}
                  </span>
                  <span className="block text-xs text-emerald-400/90 mt-0.5 leading-snug break-words">
                    {conversationLabel(savedPlanConversation)}
                  </span>
                </span>
              </span>
            </button>
          )}

          {conversations.length > 0 && (
            <div className="mb-6 text-left">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t("plan.empty.selectorLabel")}
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
                      : t("plan.empty.selectorPlaceholder")}
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
                        <span className="block font-medium text-slate-200 line-clamp-2 leading-snug">
                          {formatConversationTitle(conv)}
                        </span>
                        <span className="block text-xs text-slate-500 truncate">
                          {formatConversationSubtitle(conv)}
                        </span>
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
            className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed leading-snug whitespace-normal text-center"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" />
            ) : (
              <BrainCircuit />
            )}
            {isGenerating
              ? t("plan.empty.generatingBackground")
              : t("plan.empty.generate")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-400 min-w-0 flex-1 basis-[12rem] leading-snug break-words">
          {t("plan.header.planFor")}{" "}
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
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setViewPlan(null);
              setPlan(null);
              setError(null);
            }}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 leading-snug whitespace-normal"
          >
            {t("plan.actions.otherChat")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction("delete-plan")}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-800/50 text-red-300 hover:bg-red-900/20 flex items-center gap-1 leading-snug whitespace-normal"
          >
            <Trash2 size={14} className="shrink-0" /> {t("plan.actions.delete")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction("regenerate-plan")}
            disabled={isGenerating}
            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-600 text-indigo-300 hover:bg-indigo-900/30 disabled:opacity-50 leading-snug whitespace-normal"
          >
            {t("plan.actions.regenerate")}
          </button>
        </div>
      </div>

      {backgroundNote && (
        <div className="p-3 bg-indigo-900/30 border border-indigo-700 text-indigo-200 rounded-lg text-sm flex items-start gap-2">
          <Loader2 className="animate-spin w-4 h-4 shrink-0 mt-0.5" />
          <span className="min-w-0 break-words leading-snug">{backgroundNote}</span>
        </div>
      )}

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-indigo-400 mb-4 flex items-start gap-2 leading-snug break-words">
          <Target size={20} className="shrink-0 mt-0.5" />{" "}
          {t("plan.sections.diagnosis")}
        </h3>
        <p className="text-slate-200 leading-relaxed text-lg">
          {viewPlan.diagnosis}
        </p>
      </section>

      <section>
        <h3 className="text-xl font-bold text-white mb-4 flex items-start gap-2 leading-snug break-words">
          <Clock size={24} className="text-indigo-500 shrink-0 mt-0.5" />{" "}
          {t("plan.sections.steps")}
        </h3>
        <div className="grid gap-6 md:grid-cols-3">
          {viewPlan.steps.map((step, idx) => (
            <div
              key={`step-${idx}`}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group hover:border-indigo-500/50 transition-colors"
            >
              <div className="absolute -right-4 -top-4 text-slate-800 text-9xl font-bold opacity-20 group-hover:text-indigo-900 transition-colors select-none">
                {step.stepNumber}
              </div>
              <div className="relative z-10">
                <div className="inline-block max-w-full px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-xs font-bold mb-3 break-words whitespace-normal leading-snug">
                  {step.duration}
                </div>
                <h4 className="text-lg font-semibold text-white mb-2 break-words leading-snug">
                  {step.title}
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed break-words">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-start gap-2 leading-snug break-words">
          <MessageCircle size={24} className="text-indigo-500 shrink-0 mt-0.5" />{" "}
          {t("plan.sections.messages")}
        </h3>
        <div className="space-y-4">
          {viewPlan.messageTemplates.map((msg, idx) => (
            <div
              key={idx}
              className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-3 mb-2 min-w-0">
                <span className="text-indigo-300 font-medium text-sm min-w-0 break-words leading-snug">
                  {msg.situation}
                </span>
                <span className="text-slate-500 text-xs shrink-0 leading-snug break-words sm:text-right">
                  {msg.timing}
                </span>
              </div>
              <div className="bg-slate-950 p-4 rounded-lg border-l-4 border-indigo-500 text-slate-200 font-mono text-sm relative break-words whitespace-pre-wrap">
                &quot;{msg.text}&quot;
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-slate-900/50 border border-green-900/30 rounded-2xl p-6">
          <h3 className="text-green-400 font-bold mb-4 flex items-start gap-2 leading-snug break-words">
            <ShieldCheck size={20} className="shrink-0 mt-0.5" />{" "}
            {t("plan.sections.dos")}
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
          <h3 className="text-red-400 font-bold mb-4 flex items-start gap-2 leading-snug break-words">
            <ShieldAlert size={20} className="shrink-0 mt-0.5" />{" "}
            {t("plan.sections.donts")}
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
            {t("plan.sections.distancing")}
          </h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            {viewPlan.distancingStrategy}
          </p>
        </div>
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
          <h4 className="text-indigo-300 font-semibold mb-2">
            {t("plan.sections.triggers")}
          </h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            {viewPlan.neurologicalTriggers}
          </p>
        </div>
      </section>

      {confirmAction === "delete-plan" && (
        <ConfirmModal
          title={t("plan.deleteModal.title")}
          subtitle={t("plan.deleteModal.subtitle")}
          message={t("plan.deleteModal.message")}
          confirmLabel={t("plan.deleteModal.confirm")}
          variant="danger"
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            setConfirmAction(null);
            void deleteSavedPlan();
          }}
        />
      )}

      {confirmAction === "regenerate-plan" && (
        <ConfirmModal
          title={t("plan.regenerateModal.title")}
          subtitle={t("plan.regenerateModal.subtitle")}
          message={t("plan.regenerateModal.message")}
          confirmLabel={t("plan.regenerateModal.confirm")}
          variant="warning"
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            setConfirmAction(null);
            void runRegeneratePlan();
          }}
        />
      )}
    </div>
  );
};

export default PlanDisplay;
