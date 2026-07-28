import React, { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw, Users } from "lucide-react";
import { useI18n } from "../contexts/I18nContext";
import { apiFetch } from "../lib/api-endpoints";
import { authService } from "../lib/auth";

type UsageBucket = {
  start: string;
  end: string;
  totalUsers: number;
  chatUsers: number;
  planUsers: number;
  chatEvents: number;
  planEvents: number;
};

type UsageAnalytics = {
  hours: number;
  bucketMinutes: number;
  peakConcurrent: number;
  peakBucket: string | null;
  totalChatEvents: number;
  totalPlanEvents: number;
  uniqueUsers: number;
  buckets: UsageBucket[];
};

const HOUR_OPTIONS = [6, 12, 24, 48, 72] as const;

const AdminUsagePanel: React.FC = () => {
  const { t, formatDateTime } = useI18n();
  const [hours, setHours] = useState<number>(24);
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!authService.getToken()) {
        throw new Error(t("admin.errors.sessionMissing"));
      }

      const res = await apiFetch(
        `admin-ai-usage?hours=${hours}&bucketMinutes=15`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || t("admin.usage.loadFailed")
        );
      }
      setData((await res.json()) as UsageAnalytics);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("admin.usage.loadFailed"));
    } finally {
      setLoading(false);
    }
    // `t` changes with the language; reloading also refreshes localized errors.
  }, [hours, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxUsers =
    data?.buckets.reduce((m, b) => Math.max(m, b.totalUsers), 0) || 1;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="text-indigo-400" size={22} />
            {t("admin.usage.title")}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {t("admin.usage.description", {
              minutes: data?.bucketMinutes ?? 15,
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            aria-label={t("admin.usage.columnWindow")}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm max-w-full"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {t("admin.usage.rangeOption", { hours: h })}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-50 whitespace-normal leading-snug"
          >
            <RefreshCw size={16} className={loading ? "animate-spin shrink-0" : "shrink-0"} />
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-300 bg-red-900/20 border border-red-800 rounded-lg p-3 break-words">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-slate-400 gap-2 px-4 text-center leading-snug">
          <Loader2 className="animate-spin shrink-0" size={24} />
          {t("admin.usage.loading")}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 min-w-0">
              <p className="text-xs text-slate-400 break-words leading-snug">{t("admin.usage.peak")}</p>
              <p className="text-2xl font-bold text-indigo-300">
                {data.peakConcurrent}
              </p>
              {data.peakBucket ? (
                <p className="text-xs text-slate-500 mt-1 break-words leading-snug">
                  {t("admin.usage.peakAt", {
                    time: formatDateTime(data.peakBucket),
                  })}
                </p>
              ) : null}
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 min-w-0">
              <p className="text-xs text-slate-400 break-words leading-snug">
                {t("admin.usage.uniqueUsers", { hours })}
              </p>
              <p className="text-2xl font-bold text-white flex items-center gap-2">
                <Users size={20} className="text-slate-400 shrink-0" />
                {data.uniqueUsers}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 min-w-0">
              <p className="text-xs text-slate-400 break-words leading-snug">
                {t("admin.usage.chatRequests")}
              </p>
              <p className="text-2xl font-bold text-emerald-300">
                {data.totalChatEvents}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 min-w-0">
              <p className="text-xs text-slate-400 break-words leading-snug">
                {t("admin.usage.planRequests")}
              </p>
              <p className="text-2xl font-bold text-amber-300">
                {data.totalPlanEvents}
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-sm min-w-[36rem]">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                <tr className="text-left text-slate-400">
                  <th className="px-4 py-3 whitespace-nowrap">{t("admin.usage.columnWindow")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("admin.usage.columnUsers")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("admin.usage.columnChat")}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{t("admin.usage.columnPlan")}</th>
                  <th className="px-4 py-3 w-40 whitespace-nowrap">
                    {t("admin.usage.columnLoad")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.buckets
                  .filter((b) => b.totalUsers > 0 || b.chatEvents + b.planEvents > 0)
                  .slice()
                  .reverse()
                  .map((b) => (
                    <tr
                      key={b.start}
                      className="border-b border-slate-800/80 hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                        {formatDateTime(b.start)}
                      </td>
                      <td className="px-4 py-2 font-medium text-white">
                        {b.totalUsers}
                      </td>
                      <td className="px-4 py-2 text-emerald-400">
                        {b.chatUsers}{" "}
                        <span className="text-slate-500 text-xs whitespace-nowrap">
                          {t("admin.usage.requests", { count: b.chatEvents })}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-amber-400">
                        {b.planUsers}{" "}
                        <span className="text-slate-500 text-xs whitespace-nowrap">
                          {t("admin.usage.requests", { count: b.planEvents })}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{
                              width: `${Math.round((b.totalUsers / maxUsers) * 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {data.buckets.every(
              (b) => b.totalUsers === 0 && b.chatEvents === 0 && b.planEvents === 0
            ) ? (
              <p className="p-6 text-center text-slate-500 text-sm">
                {t("admin.usage.empty")}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminUsagePanel;
