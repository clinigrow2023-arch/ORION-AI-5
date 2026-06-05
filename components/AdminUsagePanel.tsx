import React, { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, RefreshCw, Users } from "lucide-react";
import { authService } from "../lib/auth";

type UsageBucket = {
  label: string;
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
  const [hours, setHours] = useState<number>(24);
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = authService.getToken();
      if (!token) throw new Error("Not authenticated");

      const { getApiEndpoint } = await import("../lib/api-endpoints");
      const res = await fetch(
        `${getApiEndpoint("admin-ai-usage")}?hours=${hours}&bucketMinutes=15`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || `Failed (${res.status})`
        );
      }
      setData((await res.json()) as UsageAnalytics);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxUsers =
    data?.buckets.reduce((m, b) => Math.max(m, b.totalUsers), 0) ?? 1;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="text-indigo-400" size={22} />
            AI usage (debug)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Unique users per {data?.bucketMinutes ?? 15}-minute window — chat
            and plan requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
          >
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                Last {h}h
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-300 bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex flex-1 items-center justify-center text-slate-400">
          <Loader2 className="animate-spin mr-2" size={24} />
          Loading usage…
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-400">Peak simultaneous users</p>
              <p className="text-2xl font-bold text-indigo-300">
                {data.peakConcurrent}
              </p>
              {data.peakBucket ? (
                <p className="text-xs text-slate-500 mt-1">
                  at {new Date(data.peakBucket).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-400">Unique users ({hours}h)</p>
              <p className="text-2xl font-bold text-white flex items-center gap-2">
                <Users size={20} className="text-slate-400" />
                {data.uniqueUsers}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-400">Chat requests</p>
              <p className="text-2xl font-bold text-emerald-300">
                {data.totalChatEvents}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="text-xs text-slate-400">Plan generations</p>
              <p className="text-2xl font-bold text-amber-300">
                {data.totalPlanEvents}
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                <tr className="text-left text-slate-400">
                  <th className="px-4 py-3">Time window</th>
                  <th className="px-4 py-3">Users (total)</th>
                  <th className="px-4 py-3">Chat</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3 w-40">Load</th>
                </tr>
              </thead>
              <tbody>
                {data.buckets
                  .filter((b) => b.totalUsers > 0 || b.chatEvents + b.planEvents > 0)
                  .slice()
                  .reverse()
                  .map((b) => (
                    <tr
                      key={b.label}
                      className="border-b border-slate-800/80 hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                        {b.label}
                      </td>
                      <td className="px-4 py-2 font-medium text-white">
                        {b.totalUsers}
                      </td>
                      <td className="px-4 py-2 text-emerald-400">
                        {b.chatUsers}{" "}
                        <span className="text-slate-500 text-xs">
                          ({b.chatEvents} req)
                        </span>
                      </td>
                      <td className="px-4 py-2 text-amber-400">
                        {b.planUsers}{" "}
                        <span className="text-slate-500 text-xs">
                          ({b.planEvents} req)
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
                No AI usage recorded in this period yet. Events are logged on
                each chat message and plan generation after deploy.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminUsagePanel;
