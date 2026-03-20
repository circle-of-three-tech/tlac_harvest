'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Lead {
  id: string;
  fullName: string;
  phone?: string;
  location: string;
  status: string;
  soulState: string;
  churchMembership: string;
  monthsConsistent: number;
  createdAt: string;
}

interface LeadsModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

const LeadsModal = ({ user, isOpen, onClose }: LeadsModalProps) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const pageSize = 10;

  useEffect(() => {
    if (isOpen && user) {
      fetchLeads();
    }
  }, [isOpen, user, currentPage]);

  const fetchLeads = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
        [user.role === "FOLLOWUP" ? "assignedToId" : "addedById"]: user.id,
      });

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch leads');
      }
    
      setLeads(data.leads || []);
      setTotalLeads(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / pageSize));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Assigned Leads
            </h2>
            <p className="text-slate-600 mt-1">
              {user?.name} • {totalLeads} lead{totalLeads !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">
                No leads assigned to this user yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {lead.fullName}
                      </h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-sm">
                        <div>
                          <span className="text-slate-500">Phone:</span>
                          <p className="text-slate-700">
                            {lead.phone || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Location:</span>
                          <p className="text-slate-700">{lead.location}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Status:</span>
                          <p className="text-slate-700">
                            <span className="badge bg-blue-100 text-blue-700 text-xs py-1 px-2 rounded">
                              {lead.status?.replace(/_/g, ' ')}
                            </span>
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Soul State:</span>
                          <p className="text-slate-700">
                            {lead.soulState?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Church:</span>
                          <p className="text-slate-700">
                            {lead.churchMembership?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Consistent:</span>
                          <p className="text-slate-700">
                            {lead.monthsConsistent}
                            {lead.monthsConsistent === 1
                              ? ' month'
                              : ' months'}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-3">
                        Added {format(new Date(lead.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        {leads.length > 0 && (
          <div className="border-t border-gray-200 p-4 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages} •{' '}
              {Math.min(currentPage * pageSize, totalLeads)} of {totalLeads}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 text-slate-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={18} />
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 text-slate-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsModal;
