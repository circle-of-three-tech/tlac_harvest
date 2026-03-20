// app/dashboard/followup/leads/page.tsx
"use client";
import { useState, useMemo } from "react";
import { Search, AlertCircle } from "lucide-react";
import LeadTable from "@/components/leads/LeadTable";
import { useLeadsData, usePaginatedOfflineData } from "@/hooks/useOfflineData";
import { useSync } from "@/components/SyncProvider";
import { transformCachedLeadToLead } from "@/lib/offlineLeads";

const ITEMS_PER_PAGE = 10;

export default function FollowupLeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data: allLeads, loading, error, isOffline } = useLeadsData();
  const { isOnline } = useSync();

  const filteredLeads = useMemo(() => {
    return (allLeads || []).filter((l: any) =>
      l.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.location?.toLowerCase().includes(search.toLowerCase())
    );
  }, [allLeads, search]);

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
    <div className="mt-6">
      <div className="page-header">
        <h1 className="page-title">Assigned Leads</h1>
        <p className="page-subtitle">
          {filteredLeads.length} leads
          {isOffline && " (Offline Mode)"}
        </p>
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
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="harvest-input pl-9 w-full"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white">
            Loading...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white">
            No leads found
          </div>
        ) : (
          <LeadTable
            leads={transformedLeads}
            showAssignedTo={false}
            showAddedBy={true}
            onLeadUpdated={(updated) => {
              // Leads will be refetched on sync
            }}
          />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-harvest-100">
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="harvest-btn-secondary text-xs disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="harvest-btn-secondary text-xs disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
