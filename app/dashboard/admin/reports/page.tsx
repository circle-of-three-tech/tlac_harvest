// app/dashboard/admin/reports/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Download, Mail, Loader2, Award, TrendingUp, AlertTriangle } from "lucide-react";

interface UserActivityRow {
  id: string;
  name: string;
  email: string;
  lastActivity: string;
  leadsAdded: number;
  conversions: number;
  notesAdded: number;
  statusChanges: number;
  assignmentsHandled: number;
  soulsTarget: number;
  activityScore: number;
}

interface MonthlyReport {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  totals: {
    leadsCreated: number;
    leadsConverted: number;
    leadsFollowingUp: number;
    notesAdded: number;
    smsSent: number;
    smsFailed: number;
    activeEvangelists: number;
    activeFollowups: number;
    inactiveEvangelists: number;
    inactiveFollowups: number;
  };
  statusBreakdown: { status: string; count: number }[];
  soulStateBreakdown: { soulState: string; count: number }[];
  evangelists: UserActivityRow[];
  followups: UserActivityRow[];
  topEvangelist: UserActivityRow | null;
  topFollowup: UserActivityRow | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function defaultPeriod() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export default function AdminReportsPage() {
  const initial = useMemo(defaultPeriod, []);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  async function loadReport() {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/reports/monthly?year=${year}&month=${month}`);
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to load report");
      setReport(await res.json());
    } catch (err: any) {
      setFeedback({ kind: "err", msg: err.message ?? "Failed to load report" });
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function emailReport() {
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/reports/monthly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to send report");
      setFeedback({
        kind: "ok",
        msg: `Report for ${data.periodLabel} sent to ${data.sentTo.length} admin${data.sentTo.length === 1 ? "" : "s"}.`,
      });
    } catch (err: any) {
      setFeedback({ kind: "err", msg: err.message ?? "Failed to send report" });
    } finally {
      setSending(false);
    }
  }

  function downloadCsv() {
    if (!report) return;
    const lines: string[] = [];
    lines.push(`TLAC Harvest Monthly Report,${report.periodLabel}`);
    lines.push("");
    lines.push("Totals");
    Object.entries(report.totals).forEach(([k, v]) => lines.push(`${k},${v}`));
    lines.push("");
    lines.push("Evangelists");
    lines.push("Name,Email,LeadsAdded,Conversions,NotesAdded,StatusChanges,ActivityScore,LastActivity");
    report.evangelists.forEach((r) =>
      lines.push(
        [r.name, r.email, r.leadsAdded, r.conversions, r.notesAdded, r.statusChanges, r.activityScore, r.lastActivity]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    lines.push("");
    lines.push("Follow-up Team");
    lines.push("Name,Email,LeadsHandled,Conversions,NotesAdded,StatusChanges,ActivityScore,LastActivity");
    report.followups.forEach((r) =>
      lines.push(
        [r.name, r.email, r.leadsAdded, r.conversions, r.notesAdded, r.statusChanges, r.activityScore, r.lastActivity]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tlac-report-${report.periodLabel.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-harvest-100 p-2 rounded-lg">
          <FileText className="w-6 h-6 text-harvest-700" />
        </div>
        <h1 className="text-2xl font-bold text-harvest-900">Monthly Reports</h1>
      </div>
      <p className="text-sm text-harvest-700/70 mb-6">
        Activity summary across evangelists and the follow-up team. Reports are also emailed automatically on the 1st of each month.
      </p>

      <div className="bg-white rounded-2xl border border-harvest-100 p-4 md:p-5 mb-6 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex gap-3">
          <div>
            <label className="block text-xs font-semibold text-harvest-700 uppercase tracking-wide mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="border border-harvest-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-harvest-700 uppercase tracking-wide mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="border border-harvest-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:ml-auto">
          <button
            onClick={loadReport}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-harvest-700 text-white text-sm font-medium hover:bg-harvest-800 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Generate
          </button>
          <button
            onClick={downloadCsv}
            disabled={!report}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-harvest-200 text-harvest-800 text-sm font-medium hover:bg-harvest-50 disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={emailReport}
            disabled={sending || !report}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Email Admins
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            feedback.kind === "ok"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {loading && !report && (
        <div className="flex items-center gap-2 text-harvest-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading report…
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
            <Stat label="Leads Created" value={report.totals.leadsCreated} />
            <Stat label="Converted" value={report.totals.leadsConverted} accent="text-green-600" />
            <Stat label="In Follow-up" value={report.totals.leadsFollowingUp} accent="text-orange-600" />
            <Stat label="Notes Added" value={report.totals.notesAdded} />
            <Stat label="SMS Sent" value={report.totals.smsSent} />
            <Stat label="SMS Failed" value={report.totals.smsFailed} accent="text-red-600" />
            <Stat label="Active Evangelists" value={report.totals.activeEvangelists} />
            <Stat label="Active Follow-up" value={report.totals.activeFollowups} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <TopCard title="Most Active Evangelist" row={report.topEvangelist} />
            <TopCard title="Most Active Follow-up" row={report.topFollowup} />
          </div>

          {(report.totals.inactiveEvangelists > 0 || report.totals.inactiveFollowups > 0) && (
            <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <strong>{report.totals.inactiveEvangelists}</strong> evangelist(s) and{" "}
                <strong>{report.totals.inactiveFollowups}</strong> follow-up member(s) have been inactive for 14+ days.
              </div>
            </div>
          )}

          <ActivityTable
            title="Evangelists"
            rows={report.evangelists}
            primaryLabel="Leads Added"
          />
          <ActivityTable
            title="Follow-up Team"
            rows={report.followups}
            primaryLabel="Leads Handled"
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent = "text-harvest-900" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white border border-harvest-100 rounded-xl p-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-harvest-700/70 mt-1">{label}</div>
    </div>
  );
}

function TopCard({ title, row }: { title: string; row: UserActivityRow | null }) {
  if (!row) {
    return (
      <div className="bg-white border border-harvest-100 rounded-2xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-harvest-700 mb-2">{title}</div>
        <div className="text-sm text-harvest-600/70">No activity recorded this period.</div>
      </div>
    );
  }
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-100 border border-orange-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-800 mb-2">
        <Award className="w-4 h-4" /> {title}
      </div>
      <div className="text-lg font-bold text-harvest-900">{row.name}</div>
      <div className="text-xs text-harvest-700/80 mt-1">
        Score <span className="text-orange-700 font-semibold">{row.activityScore}</span> · {row.leadsAdded} leads ·{" "}
        {row.conversions} converted · {row.notesAdded} notes
      </div>
    </div>
  );
}

function ActivityTable({
  title,
  rows,
  primaryLabel,
}: {
  title: string;
  rows: UserActivityRow[];
  primaryLabel: string;
}) {
  return (
    <div className="bg-white border border-harvest-100 rounded-2xl overflow-hidden mb-6">
      <div className="px-5 py-3 bg-harvest-50 border-b border-harvest-100 font-semibold text-harvest-900">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-harvest-900 text-white">
            <tr>
              <th className="px-3 py-2 text-left font-medium">#</th>
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Email</th>
              <th className="px-3 py-2 text-center font-medium">{primaryLabel}</th>
              <th className="px-3 py-2 text-center font-medium">Conv.</th>
              <th className="px-3 py-2 text-center font-medium">Notes</th>
              <th className="px-3 py-2 text-center font-medium hidden sm:table-cell">Status Δ</th>
              <th className="px-3 py-2 text-center font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-harvest-600/70 py-6">No users.</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-harvest-50/40"}>
                  <td className="px-3 py-2 text-harvest-700/70">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-harvest-900">{r.name}</td>
                  <td className="px-3 py-2 text-harvest-700/80 hidden md:table-cell">{r.email}</td>
                  <td className="px-3 py-2 text-center">{r.leadsAdded}</td>
                  <td className="px-3 py-2 text-center text-green-700 font-semibold">{r.conversions}</td>
                  <td className="px-3 py-2 text-center">{r.notesAdded}</td>
                  <td className="px-3 py-2 text-center hidden sm:table-cell">{r.statusChanges}</td>
                  <td className="px-3 py-2 text-center font-bold text-orange-700">{r.activityScore}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
