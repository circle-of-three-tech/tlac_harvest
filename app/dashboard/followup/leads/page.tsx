// app/dashboard/followup/leads/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import LeadTable from "@/components/leads/LeadTable";

export default function FollowupLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLeads = async () => {
    setLoading(true);
    const res = await fetch(`/api/leads?page=${page}&limit=10`);
    const data = await res.json();
    setLeads(data.leads ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [page]);

  const filtered = leads.filter(l =>
    l.fullName.toLowerCase().includes(search.toLowerCase()) ||
    l.location.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="mt-6">
      <div className="page-header">
        <h1 className="page-title">Assigned Leads</h1>
        <p className="page-subtitle">{total} leads assigned to you</p>
      </div>

      <div className="harvest-card overflow-hidden">
        <div className="flex items-center gap-3 py-4 border-b border-harvest-100">
          <div className="relative flex-1 max-w-sm">
            {/* <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" /> */}
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="harvest-input pl-9 w-full"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white">Loading...</div>
        ) : (
          <LeadTable
            leads={filtered}
            showAssignedTo={false}
            showAddedBy={true}
            onLeadUpdated={updated => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
          />
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-harvest-100">
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="harvest-btn-secondary text-xs disabled:opacity-40">← Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="harvest-btn-secondary text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
