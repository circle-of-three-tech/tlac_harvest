"use client";
import { useState } from "react";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { LEAD_STATUS_LABELS, SOUL_STATE_LABELS, AGE_RANGE_LABELS, getAttendanceStatus, cn } from "@/lib/utils";
import { format } from "date-fns";
import LeadDetailModal from "./LeadDetailModal"; 

export interface Lead {
  id: string;
  fullName: string;
  location: string;
  soulState: string;
  status: string;
  ageRange: string;
  monthsConsistent?: number;
  churchMembership?: boolean;
  assignedTo?: { id: string; name: string } | null;
  addedBy?: { id: string; name: string } | null;
  createdAt: string;
}

interface Props {
  leads: Lead[];
  showAssignedTo?: boolean;
  showAddedBy?: boolean;
  isAdmin?: boolean;
  onLeadUpdated?: (lead: Lead) => void;
  onLeadDeleted?: (id: string) => void;
  pageSize?: number;
}

const STATUS_CLASSES: Record<string, string> = {
  NEW_LEAD: "badge badge-new",
  FOLLOWING_UP: "badge badge-following",
  CONVERTED: "badge badge-converted",
};

const SOUL_CLASSES: Record<string, string> = {
  UNBELIEVER: "badge badge-unbeliever",
  UNCHURCHED_BELIEVER: "badge badge-unchurched",
  HUNGRY_BELIEVER: "badge badge-hungry",
};

// Safe date formatter that handles invalid dates
const formatDate = (dateValue: string): string => {
  if (!dateValue) return "—";
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return "—";
    return format(date, "MMMM d, yyyy");
  } catch {
    return "—";
  }
};

export default function LeadTable({ leads, showAssignedTo = true, showAddedBy = false, isAdmin = false, onLeadUpdated, onLeadDeleted, pageSize = 10 }: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const totalPages = Math.ceil(leads.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLeads = leads.slice(startIndex, startIndex + pageSize);

  if (leads.length === 0) {
    return (
      <div className="py-16 text-center bg-white">
        <div className="text-4xl mb-3">🌾</div>
        <p className="text-slate-400 text-sm">No leads yet. The harvest awaits!</p>
      </div>
    );
  }

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block w-full overflow-x-auto">
        <table className="harvest-table min-w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Soul State</th>
              <th>Status</th>
              {showAddedBy && <th>Added By</th>}
              {showAssignedTo && <th>Assigned To</th>}
              <th>Attendance</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {paginatedLeads.map((lead, index) => {
              const att = getAttendanceStatus(lead.monthsConsistent ?? 0);
              return (
                <tr key={index} className={`hover:bg-slate-100 cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`} onClick={() => setSelectedLead(lead)}>
                  <td>
                    <div className="font-medium text-slate-900">{lead.fullName}</div>
                    <div className="text-xs text-slate-400">{AGE_RANGE_LABELS[lead.ageRange as keyof typeof AGE_RANGE_LABELS]}</div>
                  </td>
                  <td className="text-slate-600">{lead.location}</td>
                  <td>
                    <span className={SOUL_CLASSES[lead.soulState] || "badge"}>
                      {SOUL_STATE_LABELS[lead.soulState as keyof typeof SOUL_STATE_LABELS]}
                    </span>
                  </td>
                  <td>
                    <span className={STATUS_CLASSES[lead.status] || "badge"}>
                      {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS]}
                    </span>
                  </td>
                  {showAddedBy && (
                    <td className="text-slate-600">{lead.addedBy?.name ?? "—"}</td>
                  )}
                  {showAssignedTo && (
                    <td className="text-slate-600">{lead.assignedTo?.name ?? <span className="text-slate-300 italic text-xs">Unassigned</span>}</td>
                  )}
                  <td>
                    {(lead?.monthsConsistent &&lead?.monthsConsistent > 0 || lead?.churchMembership) ? (
                      <span className={cn("badge text-xs", att.bg, att.color)}>{att.label}</span>
                    ) : (
                      <span className="text-slate-300 text-xs italic">—</span>
                    )}
                  </td>
                  <td className="text-slate-400 text-xs">
                    {formatDate(lead.createdAt)}
                  </td>
                  <td>
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-harvest-600 hover:bg-harvest-50 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet List View */}
      <div className="lg:hidden space-y-3">
        {paginatedLeads.map(lead => {
          const att = getAttendanceStatus(lead.monthsConsistent ?? 0);
          return (
            <div
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              className="p-4 bg-white shadow-md hover:shadow-lg border border-slate-100 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{lead.fullName}</div>
                  <div className="text-xs text-slate-400">{AGE_RANGE_LABELS[lead.ageRange as keyof typeof AGE_RANGE_LABELS]}</div>
                </div>
                <Eye className="w-5 h-5 text-slate-400" />
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Location</span>
                  <span className="text-slate-900 font-medium">{lead.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Soul State</span>
                  <span className={SOUL_CLASSES[lead.soulState] || "badge"}>
                    {SOUL_STATE_LABELS[lead.soulState as keyof typeof SOUL_STATE_LABELS]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={STATUS_CLASSES[lead.status] || "badge"}>
                    {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS]}
                  </span>
                </div>
                {showAddedBy && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Added By</span>
                    <span className="text-slate-900">{lead.addedBy?.name ?? "—"}</span>
                  </div>
                )}
                {showAssignedTo && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned To</span>
                    <span className="text-slate-900">{lead.assignedTo?.name ?? <span className="text-slate-300 italic">Unassigned</span>}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Attendance</span>
                  {(lead?.monthsConsistent && lead?.monthsConsistent > 0 || lead.churchMembership) ? (
                    <span className={cn("badge text-xs", att.bg, att.color)}>{att.label}</span>
                  ) : (
                    <span className="text-slate-300 text-xs italic">—</span>
                  )}
                </div>
                <div className="flex justify-between pt-2 border-t border-harvest-100">
                  <span className="text-slate-500">Date</span>
                  <span className="text-slate-400 text-xs">{formatDate(lead.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Page <span className="font-semibold">{currentPage}</span> of{" "}
            <span className="font-semibold">{totalPages}</span> ({leads.length} total)
          </p>

          <div className="flex gap-2">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              title="Previous page"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              title="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          isAdmin={isAdmin}
          onClose={() => setSelectedLead(null)}
          onUpdated={(updated) => {
            setSelectedLead(updated);
            onLeadUpdated?.(updated);
          }}
          onDeleted={(id) => {
            setSelectedLead(null);
            onLeadDeleted?.(id);
          }}
        />
      )}
    </>
  );
}
