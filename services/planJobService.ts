import { ActionPlan } from "../types";
import { authService } from "../lib/auth";
import { friendlyPlanErrorMessage } from "../lib/plan-utils";

export type PlanJobStatus = "pending" | "ready" | "error";

export interface PlanJob {
  conversationId: string;
  status: PlanJobStatus;
  startedAt: number;
  finishedAt?: number;
  error?: string;
}

const JOBS_KEY = "orion_plan_jobs";
const PLAN_READY_EVENT = "orion-plan-ready";

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
    new Notification("Orion AI", {
      body: "Your action plan is ready.",
      icon: "/favicon.ico",
    });
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

export function startPlanGeneration(options: {
  conversationId: string;
  contextHistory: string;
  onComplete?: (plan: ActionPlan) => void;
  onError?: (message: string) => void;
}): void {
  const { conversationId, contextHistory, onComplete, onError } = options;

  setPlanJob({
    conversationId,
    status: "pending",
    startedAt: Date.now(),
  });

  void (async () => {
    try {
      const token = authService.getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const response = await fetch(getApiEndpoint("plan"), {
        method: "POST",
        headers,
        body: JSON.stringify({ conversationId, contextHistory }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          friendlyPlanErrorMessage(
            (err as { error?: string }).error ||
              `Plan failed (${response.status})`
          )
        );
      }

      const data = await response.json();
      const plan = (data.plan || data.response) as ActionPlan;
      if (!plan?.steps?.length) {
        throw new Error("Generated plan was incomplete");
      }

      setPlanJob({
        conversationId,
        status: "ready",
        startedAt: readJobs()[conversationId]?.startedAt ?? Date.now(),
        finishedAt: Date.now(),
      });

      notifyPlanReady(conversationId);
      onComplete?.(plan);
    } catch (e: unknown) {
      const message = friendlyPlanErrorMessage(
        e instanceof Error ? e.message : "Failed to generate action plan"
      );
      setPlanJob({
        conversationId,
        status: "error",
        startedAt: readJobs()[conversationId]?.startedAt ?? Date.now(),
        finishedAt: Date.now(),
        error: message,
      });
      onError?.(message);
    }
  })();
}
