// app/dashboard/evangelist/leads/page.tsx
"use client";
import { useState, useEffect } from "react";
import { UserRoundPlus, Search, Filter } from "lucide-react";
import LeadTable from "@/components/leads/LeadTable";
import AddLeadModal from "@/components/leads/AddLeadModal";

export default function EvangelistLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
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
    <div>
      <div className="pt-12 page-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="page-title">My Leads</h1>
          <p className="page-subtitle">{total} leads added by you</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="harvest-btn-primary w-full sm:w-auto">
          <UserRoundPlus className="w-4 h-4" /> Add Lead
        </button>
      </div>

      <div className="harvest-card overflow-hidden">
        <div className="flex items-center gap-3 py-4 border-b border-harvest-100">
          <div className="relative flex-1">
            {/* <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" /> */}
            <input
              type="text"
              placeholder="Search by name or location..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="harvest-input pl-9"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white">Loading leads...</div>
        ) : (
          <LeadTable
            leads={filtered}
            onLeadUpdated={(updated) => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
          />
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4 border-t border-harvest-100">
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="harvest-btn-secondary text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
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
            setLeads(prev => [newLead, ...prev]);
            setTotal(t => t + 1);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
