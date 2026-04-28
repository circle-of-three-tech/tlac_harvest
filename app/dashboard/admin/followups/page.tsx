// app/dashboard/admin/followups/page.tsx
"use client";
import { useState, useEffect } from "react"; 
import { UserCheck } from "lucide-react";
import FollowupTable from "@/components/followupTable/FollowupTable";

export default function FollowupsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch(`/api/users?role=FOLLOWUP&page=${page}&limit=15`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const totalPages = Math.ceil(total / 15);

  return (
    <div className="py-8">
      <div className="page-header">
        <h1 className="page-title">Follow-Up Team</h1>
        <p className="page-subtitle">{total} follow-up members registered</p>
      </div>

      <div className="harvest-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 bg-white">Loading...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2 bg-white" />
            <p className="text-slate-400 text-sm">No follow-up members yet</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-2 px-2 lg:mx-0 lg:px-0">
         <FollowupTable followups={users} />
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4 border-t border-harvest-100">
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2 w-full sm:w-auto">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="harvest-btn-secondary text-xs disabled:opacity-40">← Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="harvest-btn-secondary text-xs disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
