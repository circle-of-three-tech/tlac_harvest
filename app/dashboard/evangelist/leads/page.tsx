// app/dashboard/evangelist/leads/page.tsx
"use client";
import { useState, useMemo } from "react";
import { UserRoundPlus, Search, AlertCircle } from "lucide-react";
import LeadTable from "@/components/leads/LeadTable";
import AddLeadModal from "@/components/leads/AddLeadModal";
import { useLeadsData, usePaginatedOfflineData } from "@/hooks/useOfflineData";
import { useSync } from "@/components/SyncProvider";
import { transformCachedLeadToLead } from "@/lib/offlineLeads";

const ITEMS_PER_PAGE = 10;

export default function EvangelistLeadsPage() {
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allLeads, loading, error, isOffline } = useLeadsData();
  const { isOnline } = useSync();

  // Filter leads content-wise
  const filteredLeads = useMemo(() => {
    return (allLeads || []).filter(
      (l: any) =>
        l.fullName.toLowerCase().includes(search.toLowerCase()) ||
        l.location?.toLowerCase().includes(search.toLowerCase())
    );
  }, [allLeads, search]);

  // Paginate
  const { data: paginatedLeads, totalPages } = usePaginatedOfflineData(
    filteredLeads as any[],
    ITEMS_PER_PAGE,
    page
  );

  // Transform cached leads to Lead interface
  const transformedLeads = useMemo(
    () => (paginatedLeads as any[]).map(transformCachedLeadToLead),
    [paginatedLeads]
  );

  return (
    <div>
      <div className="pt-12 page-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title">My Leads</h1>
          <p className="page-subtitle">
            {filteredLeads.length} leads
            {isOffline && " (Offline Mode)"}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="harvest-btn-primary w-full sm:w-auto"
        >
          <UserRoundPlus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      {error && isOnline && (
        <div className="harvest-card mb-4 bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Unable to load leads from server</p>
            <p className="text-xs mt-1">
              {isOffline ? "Showing cached data" : "Please check your connection"}
            </p>
          </div>
        </div>
      )}

      <div className="harvest-card overflow-hidden">
        <div className="flex items-center gap-3 py-4 border-b border-harvest-100">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="harvest-input pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white">
            Loading leads...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white">
            No leads found
          </div>
        ) : (
          <LeadTable
            leads={transformedLeads}
            onLeadUpdated={(updated) => {
              // Leads will be refetched on sync
            }}
          />
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4 border-t border-harvest-100">
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="harvest-btn-secondary text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="harvest-btn-secondary text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(newLead) => {
            setShowAddModal(false);
            // Leads will be updated on sync or cache refresh
          }}
        />
      )}
    </div>
  );
}
