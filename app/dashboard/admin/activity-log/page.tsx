"use client";
import { useState, useEffect } from "react";
import { Search, Filter, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import ActivityDetailModal from "@/components/admin/ActivityDetailModal";
import { LEAD_STATUS_LABELS, SOUL_STATE_LABELS } from "@/lib/utils";

const AUDIT_TYPE_LABELS: Record<string, string> = {
  NOTE: "Note Added",
  FIELD_CHANGE: "Field Changed",
  SMS_SENT: "SMS Sent",
  STATUS_CHANGE: "Status Changed",
  ASSIGNMENT: "Lead Assigned",
};

const AUDIT_TYPE_COLORS: Record<string, string> = {
  NOTE: "bg-blue-100 text-blue-700",
  FIELD_CHANGE: "bg-purple-100 text-purple-700",
  SMS_SENT: "bg-green-100 text-green-700",
  STATUS_CHANGE: "bg-yellow-100 text-yellow-700",
  ASSIGNMENT: "bg-orange-100 text-orange-700",
};

export default function ActivityLogPage() {
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchActivityLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (typeFilter) params.set("type", typeFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (search) params.set("search", search);

    const res = await fetch(`/api/admin/activity-log?${params}`);
    const data = await res.json();
    setActivityLogs(data.auditLogs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchActivityLogs();
  }, [page, typeFilter, dateFrom, dateTo]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchActivityLogs();
  };

  const handleClear = () => {
    setSearch("");
    setTypeFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setTimeout(() => fetchActivityLogs(), 50);
  };

  const totalPages = Math.ceil(total / 15);

  const getActivityDescription = (log: any): string => {
    switch (log.type) {
      case "NOTE":
        return `Added a note: "${log.noteContent?.substring(0, 50)}${log.noteContent && log.noteContent.length > 50 ? "..." : ""}"`;
      case "FIELD_CHANGE":
        return `Changed ${log.fieldName} from "${log.oldValue}" to "${log.newValue}"`;
      case "STATUS_CHANGE":
        return `Changed status from "${log.oldValue}" to "${log.newValue}"`;
      case "ASSIGNMENT":
        return `Assigned to ${log.details?.assignedToUserName || "unassigned"}`;
      case "SMS_SENT":
        return `Sent SMS to ${log.details?.recipientPhone}`;
      default:
        return log.type;
    }
  };

  return (
    <div className="py-8">
      <div className="page-header">
        <h1 className="page-title">Activity Log</h1>
        <p className="page-subtitle">Track all lead updates and changes</p>
      </div>

      <div className="harvest-card overflow-hidden">
        {/* Filters bar */}
        <div>
          <div className="w-full mb-2 bg-harvest-800 rounded-xl">
            <button
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className="w-full flex justify-between text-white bg-harvest-800 py-2 px-4 rounded-xl"
            >
              <span className="flex gap-2 items-center"><Filter className="w-4 h-4" /> Filter</span>
              {isFilterOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          <form
            onSubmit={handleFilter}
            className={`flex flex-col sm:flex-row sm:items-end gap-2 w-full p-4 bg-harvest-100 rounded-xl ${isFilterOpen ? "block" : "hidden"}`}
          >
            <div className="flex-1">
              <label className="text-xs text-slate-600 block mb-1">Search Lead</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, location..."
                className="harvest-input text-xs py-2 w-full"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Activity Type</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="harvest-input text-xs py-2 w-full sm:w-40">
                <option value="">All Types</option>
                {Object.entries(AUDIT_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="harvest-input text-xs py-2 w-full sm:w-36" />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="harvest-input text-xs py-2 w-full sm:w-36" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button type="submit" className="harvest-btn-primary text-center text-xs py-2 flex-1 sm:flex-none">
                Filter
              </button>
              {(search || typeFilter || dateFrom || dateTo) && (
                <button type="button" onClick={handleClear} className="harvest-btn-secondary text-xs py-2 flex-1 sm:flex-none">
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Activity Table & Card List */}
        {loading ? (
          <div className="p-8 text-center text-slate-500 bg-white">Loading activity logs...</div>
        ) : activityLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white">No activity found</div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs shadow-md rounded-lg overflow-hidden">
                <thead>
                  <tr className="border-b border-harvest-200 bg-harvest-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Timestamp</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Lead</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Activity Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Updated By</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.map((log, idx) => (
                    <tr
                      key={log.id}
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetailModal(true);
                      }}
                      className={`hover:bg-harvest-50 cursor-pointer transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-harvest-50/30"}`}
                    >
                      <td className="px-4 py-3 text-slate-600">{format(new Date(log.createdAt), "MMM d, HH:mm")}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="font-semibold text-harvest-700">{log.lead?.fullName}</div>
                        <div className="text-slate-500">{log.lead?.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full font-medium ${AUDIT_TYPE_COLORS[log.type] || "bg-gray-100 text-gray-700"}`}>
                          {AUDIT_TYPE_LABELS[log.type] || log.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-700">{log.user?.name}</div>
                        <div className="text-slate-500">{log.user?.role}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{getActivityDescription(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetailModal(true);
                  }}
                  className="bg-white shadow-md hover:shadow-lg rounded-lg p-4 hover:bg-harvest-50 cursor-pointer transition-colors"
                >
                  {/* Timestamp & Activity Type */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-xs text-slate-600">{format(new Date(log.createdAt), "MMM d, HH:mm")}</div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${AUDIT_TYPE_COLORS[log.type] || "bg-gray-100 text-gray-700"}`}>
                      {AUDIT_TYPE_LABELS[log.type] || log.type}
                    </span>
                  </div>

                  {/* Lead Info */}
                  <div className="mb-3">
                    <div className="font-semibold text-harvest-700 text-sm">{log.lead?.fullName}</div>
                    <div className="text-xs text-slate-500">{log.lead?.phone}</div>
                  </div>

                  {/* Description */}
                  <div className="mb-3 text-xs text-slate-600 bg-harvest-50 p-2 rounded">
                    {getActivityDescription(log)}
                  </div>

                  {/* Updated By */}
                  <div className="border-t border-harvest-100 pt-2">
                    <div className="text-xs text-slate-700">
                      <span className="font-medium">By:</span> {log.user?.name}
                    </div>
                    <div className="text-xs text-slate-500">{log.user?.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-harvest-200 bg-harvest-50">
            <div className="text-xs text-slate-600">
              Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, total)} of {total} activities
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="harvest-btn-secondary text-xs py-1 px-3 disabled:opacity-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-3 h-3" /> Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="harvest-btn-secondary text-xs py-1 px-3 disabled:opacity-50 flex items-center gap-1"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activity Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="relative z-50">
          <ActivityDetailModal log={selectedLog} onClose={() => setShowDetailModal(false)} />
        </div>
      )}
    </div>
  );
}
