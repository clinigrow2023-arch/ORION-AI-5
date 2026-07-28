import { ActionPlan } from "../types";
import { apiFetch } from "../lib/api-endpoints";
import {
  classifyPlanError,
  planErrorMessageKey,
  type PlanErrorCode,
} from "../lib/plan-utils";
import { formatConversationPreviewTitle } from "../lib/conversation-label";
import { ORION_MANIFEST_ICON } from "../lib/brand";
import { translateActive } from "../lib/i18n";

export type PlanJobStatus = "pending" | "ready" | "error";

export interface PlanJob {
  conversationId: string;
  status: PlanJobStatus;
  startedAt: number;
  finishedAt?: number;
  /** Fallback text (already localized by the API) used when `errorCode` is "unknown". */
  error?: string;
  /** Persisted instead of a sentence so the job survives a language change. */
  errorCode?: PlanErrorCode;
  previewTitle?: string;
}

const JOBS_KEY = "orion_plan_jobs";
const PLAN_READY_EVENT = "orion-plan-ready";
/** Ignore duplicate clicks / Strict Mode while a request is in flight */
const inFlightConversations = new Set<string>();
const PENDING_JOB_MAX_AGE_MS = 15 * 60 * 1000;

function readJobs(): Record<string, PlanJob> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(JOBS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeJobs(jobs: Record<string, PlanJob>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(JOBS_KEY, JSON.stringify(jobs));
}

export function getPlanJob(conversationId: string): PlanJob | null {
  return readJobs()[conversationId] ?? null;
}

export function getAnyPendingPlanJob(): PlanJob | null {
  return (
    Object.values(readJobs()).find((j) => j.status === "pending") ?? null
  );
}

export function getReadyPlanJob(): PlanJob | null {
  const ready = Object.values(readJobs()).filter((j) => j.status === "ready");
  if (!ready.length) return null;
  return ready.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0];
}

const PLAN_OPEN_EVENT = "orion-plan-open";

function setPlanJob(job: PlanJob): void {
  const jobs = readJobs();
  jobs[job.conversationId] = job;
  writeJobs(jobs);
}

export function clearPlanJob(conversationId: string): void {
  const jobs = readJobs();
  delete jobs[conversationId];
  writeJobs(jobs);
}

function notifyPlanReady(conversationId: string): void {
  window.dispatchEvent(
    new CustomEvent(PLAN_READY_EVENT, { detail: { conversationId } })
  );
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    const job = readJobs()[conversationId];
    const title = formatConversationPreviewTitle(job?.previewTitle);
    const notification = new Notification(translateActive("app.name"), {
      body: translateActive("plan.notification.ready", { title }),
      icon: ORION_MANIFEST_ICON,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
      window.dispatchEvent(
        new CustomEvent(PLAN_OPEN_EVENT, { detail: { conversationId } })
      );
    };
  }
}

export async function requestPlanNotificationPermission(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export function subscribePlanReady(
  handler: (conversationId: string) => void
): () => void {
  const fn = (e: Event) => {
    const id = (e as CustomEvent<{ conversationId: string }>).detail
      ?.conversationId;
    if (id) handler(id);
  };
  window.addEventListener(PLAN_READY_EVENT, fn);
  return () => window.removeEventListener(PLAN_READY_EVENT, fn);
}

/** Fired when user clicks the browser notification (or in-app open plan). */
export function subscribePlanOpen(
  handler: (conversationId: string) => void
): () => void {
  const fn = (e: Event) => {
    const id = (e as CustomEvent<{ conversationId: string }>).detail
      ?.conversationId;
    if (id) handler(id);
  };
  window.addEventListener(PLAN_OPEN_EVENT, fn);
  return () => window.removeEventListener(PLAN_OPEN_EVENT, fn);
}

export function startPlanGeneration(options: {
  conversationId: string;
  contextHistory: string;
  regenerate?: boolean;
  previewTitle?: string;
  onComplete?: (plan: ActionPlan) => void;
  onError?: (message: string) => void;
}): boolean {
  const {
    conversationId,
    contextHistory,
    regenerate,
    previewTitle,
    onComplete,
    onError,
  } = options;

  if (inFlightConversations.has(conversationId)) {
    return false;
  }

  const existing = getPlanJob(conversationId);
  if (
    existing?.status === "pending" &&
    Date.now() - existing.startedAt < PENDING_JOB_MAX_AGE_MS
  ) {
    return false;
  }

  inFlightConversations.add(conversationId);

  setPlanJob({
    conversationId,
    status: "pending",
    startedAt: Date.now(),
    previewTitle,
  });

  void (async () => {
    try {
      const response = await apiFetch("plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          contextHistory,
          regenerate: !!regenerate,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          err.error || translateActive("plan.errors.unknown")
        );
      }

      const data = await response.json();
      const plan = (data.plan || data.response) as ActionPlan;
      if (!plan?.steps?.length) {
        throw new Error(translateActive("plan.errors.incomplete"));
      }

      setPlanJob({
        conversationId,
        status: "ready",
        startedAt: readJobs()[conversationId]?.startedAt ?? Date.now(),
        finishedAt: Date.now(),
        previewTitle:
          readJobs()[conversationId]?.previewTitle ?? previewTitle,
      });

      notifyPlanReady(conversationId);
      onComplete?.(plan);
    } catch (e: unknown) {
      const raw =
        e instanceof Error ? e.message : translateActive("plan.errors.unknown");
      const errorCode = classifyPlanError(raw);
      const message =
        errorCode === "unknown"
          ? raw
          : translateActive(planErrorMessageKey(errorCode));

      setPlanJob({
        conversationId,
        status: "error",
        startedAt: readJobs()[conversationId]?.startedAt ?? Date.now(),
        finishedAt: Date.now(),
        error: raw,
        errorCode,
      });
      onError?.(message);
    } finally {
      inFlightConversations.delete(conversationId);
    }
  })();

  return true;
}
