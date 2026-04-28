// app/dashboard/admin/sms-logs/page.tsx
"use client";
import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Clock, ChevronLeft, ChevronRight, Filter, X, RotateCcw } from "lucide-react";

interface SMSLog {
  id: string;
  type: string;
  recipientPhone: string;
  content: string;
  status: "PENDING" | "SENT" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  lead: {
    id: string;
    fullName: string;
  } | null;
}

interface FetchResponse {
  logs: SMSLog[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const SMS_TYPES: Record<string, string> = {
  NEW_LEAD_NOTIFICATION: "New Lead",
  ADMIN_ALERT: "Admin Alert",
  FOLLOWUP_ASSIGNMENT: "Followup Assignment",
};

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  PENDING: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending" },
  SENT: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Sent" },
  FAILED: { color: "bg-red-100 text-red-800", icon: AlertCircle, label: "Failed" },
};

export default function SMSLogsPage() {
  const [logs, setLogs] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [limit] = useState(10);

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchLogs = async (pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      });

      if (typeFilter) params.append("type", typeFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (phoneFilter) params.append("phone", phoneFilter);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const res = await fetch(`/api/admin/sms-logs?${params}`);
      const data: FetchResponse = await res.json();

      setLogs(data.logs);
      setPage(data.page);
      setTotal(data.total);
      setPages(data.pages);
    } catch (error) {
      console.error("Failed to fetch SMS logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [typeFilter, statusFilter, phoneFilter, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setTypeFilter("");
    setStatusFilter("");
    setPhoneFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleRetryFailed = async (logId: string) => {
    setRetryingId(logId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/sms-logs/${logId}/retry`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to retry SMS");
        setRetryingId(null);
        return;
      }

      setSuccess("SMS retry sent successfully! Refreshing logs...");
      setRetryingId(null);
      // Refresh the logs to show updated status
      setTimeout(() => fetchLogs(page), 1000);
    } catch (error) {
      console.error("Failed to retry SMS:", error);
      setError("An error occurred while retrying SMS");
      setRetryingId(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="page-title">SMS Logs</h1>
        <p className="page-subtitle">Track all SMS messages sent through the system</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <input
            type="text"
            placeholder="Phone number"
            value={phoneFilter}
            onChange={(e) => {
              setPhoneFilter(e.target.value);
              setPage(1);
            }}
            className="harvest-input text-sm"
          />

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="harvest-input text-sm"
          >
            <option value="">All Types</option>
            {Object.entries(SMS_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="harvest-input text-sm"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="harvest-input text-sm"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="harvest-input text-sm"
          />
        </div>

        {(phoneFilter || typeFilter || statusFilter || dateFrom || dateTo) && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-2 text-sm text-harvest-600 hover:text-harvest-700 font-medium"
          >
            <X size={16} /> Clear Filters
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">{total}</span> total SMS logs
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-200/20 text-red-500 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-200/20 text-green-500 rounded-lg flex items-center gap-2">
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading SMS logs...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No SMS logs found</div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Recipient</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Content</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Sent Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Lead</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => {
                    const statusConfig = STATUS_CONFIG[log.status];
                    const StatusIcon = statusConfig.icon;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-900 font-medium">
                          {SMS_TYPES[log.type]}
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                          {log.recipientPhone}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-md truncate">
                          {log.content}
                        </td>
                        <td className="px-4 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon size={14} />
                            {statusConfig.label}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {formatDate(log.sentAt || log.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">
                          {log.lead?.fullName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {log.status === "FAILED" ? (
                            <button
                              onClick={() => handleRetryFailed(log.id)}
                              disabled={retryingId === log.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              title="Retry sending this SMS"
                            >
                              <RotateCcw size={14} />
                              {retryingId === log.id ? "Retrying..." : "Retry"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => {
              const statusConfig = STATUS_CONFIG[log.status];
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={log.id}
                  className="bg-white border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        {SMS_TYPES[log.type]}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(log.sentAt || log.createdAt)}
                      </p>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                      <StatusIcon size={14} />
                      {statusConfig.label}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Recipient</p>
                      <p className="text-slate-900 font-mono">{log.recipientPhone}</p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">Content</p>
                      <p className="text-slate-700 line-clamp-2">{log.content}</p>
                    </div>

                    {log.lead && (
                      <div>
                        <p className="text-xs text-slate-500">Lead</p>
                        <p className="text-slate-900">{log.lead.fullName}</p>
                      </div>
                    )}

                    {log.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                        <p className="text-xs text-red-700">
                          <span className="font-semibold">Error:</span> {log.errorMessage}
                        </p>
                      </div>
                    )}

                    {log.status === "FAILED" && (
                      <button
                        onClick={() => handleRetryFailed(log.id)}
                        disabled={retryingId === log.id}
                        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <RotateCcw size={16} />
                        {retryingId === log.id ? "Retrying..." : "Retry Sending"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Page <span className="font-semibold">{page}</span> of{" "}
                <span className="font-semibold">{pages}</span> ({total} total)
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => fetchLogs(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  onClick={() => fetchLogs(page + 1)}
                  disabled={page === pages}
                  className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
