// app/dashboard/admin/leads/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Search, Filter, ChevronDown, ChevronRight, UserRoundPlus } from "lucide-react";
import LeadTable from "@/components/leads/LeadTable";
import { LEAD_STATUS_LABELS, SOUL_STATE_LABELS } from "@/lib/utils";
import AddLeadModal from "@/components/leads/AddLeadModal";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [soulFilter, setSoulFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (statusFilter) params.set("status", statusFilter);
    if (soulFilter) params.set("soulState", soulFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };
  const handleLeadAdded = (newLead: any) => {
    setLeads((prev) => [newLead, ...prev]);
    setShowAddModal(false);
  };

  useEffect(() => {
    fetchLeads();
  }, [page, statusFilter, soulFilter, dateFrom, dateTo]);

  const filtered = leads.filter(
    (l) =>
      l.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase()) ||
      l.addedBy?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="py-8">
      <div className="page-header w-full flex justify-between">
        <div>
          <h1 className="page-title">All Leads</h1>
          <p className="page-subtitle">{total} total leads in the system</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="harvest-btn-primary w-fit sm:w-auto"
        >
          <UserRoundPlus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      <div className="harvest-card overflow-hidden">
        {/* Filters bar */}
        <div>
          <div className="w-full mb-2 bg-harvest-800 rounded-xl">
            <button
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={`w-full flex sm:justify-between md:justify-start text-white bg-harvest-500 py-2 px-4 rounded-xl `}
            >
              Filters {isFilterOpen ? <ChevronDown /> : <ChevronRight />}{" "}
            </button>
          </div>
          {/* fields */}
          <div
            className={`flex flex-col gap-3 px-4 sm:px-6 py-4 border-b border-harvest-100 bg-white ${isFilterOpen ? "block" : "hidden"}`}
          >
            <div className="relative w-full">
              {/* <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" /> */}
              <input
                type="text"
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="harvest-input pl-12 text-xs py-2 w-full"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap w-full">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="harvest-select text-xs py-2 flex-1 sm:flex-none w-full"
              >
                <option value="">All Statuses</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>

              <select
                value={soulFilter}
                onChange={(e) => {
                  setSoulFilter(e.target.value);
                  setPage(1);
                }}
                className="harvest-select text-xs py-2 flex-1 sm:flex-none w-full"
              >
                <option value="">All Soul States</option>
                {Object.entries(SOUL_STATE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="harvest-input text-xs py-2 flex-1 sm:flex-none w-full"
                placeholder="From"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="harvest-input text-xs py-2 flex-1 sm:flex-none w-full"
                placeholder="To"
              />

              {(statusFilter || soulFilter || dateFrom || dateTo) && (
                <button
                  onClick={() => {
                    setStatusFilter("");
                    setSoulFilter("");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}
                  className="harvest-btn-secondary text-xs py-2 flex-1 sm:flex-none"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white">
            Loading leads...
          </div>
        ) : (
          <LeadTable
            leads={filtered}
            showAddedBy={true}
            showAssignedTo={true}
            isAdmin={true}
            onLeadUpdated={(updated) =>
              setLeads((prev) =>
                prev.map((l) => (l.id === updated.id ? updated : l)),
              )
            }
            onLeadDeleted={(id) => {
              setLeads((prev) => prev.filter((l) => l.id !== id));
              setTotal((t) => t - 1);
            }}
          />
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4 border-t border-harvest-100">
            <span className="text-xs sm:text-sm text-slate-500 order-2 sm:order-1">
              Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} of{" "}
              {total}
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 order-1 sm:order-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="harvest-btn-secondary text-xs disabled:opacity-40 w-full sm:w-auto"
              >
                ← Prev
              </button>
              <div className="flex gap-1 justify-center sm:justify-start overflow-x-auto">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 flex-shrink-0 rounded-lg text-xs font-medium transition-all ${p === page ? "bg-harvest-500 text-white" : "bg-harvest-50 text-slate-600 hover:bg-harvest-100"}`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="harvest-btn-secondary text-xs disabled:opacity-40 w-full sm:w-auto"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {showAddModal && (
          <AddLeadModal
            onClose={() => setShowAddModal(false)}
            onSuccess={handleLeadAdded}
          />
        )}
      </div>
    </div>
  );
}
