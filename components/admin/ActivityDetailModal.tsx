"use client";
import { X } from "lucide-react";
import { format } from "date-fns";
import { LEAD_STATUS_LABELS, SOUL_STATE_LABELS, AGE_RANGE_LABELS, CHURCH_LABELS, getAttendanceStatus } from "@/lib/utils";

const AUDIT_TYPE_LABELS: Record<string, string> = {
  NOTE: "Note Added",
  FIELD_CHANGE: "Field Changed",
  SMS_SENT: "SMS Sent",
  STATUS_CHANGE: "Status Changed",
  ASSIGNMENT: "Lead Assigned",
};

export default function ActivityDetailModal({ log, onClose }: { log: any; onClose: () => void }) {
  const att = getAttendanceStatus(log.lead?.monthsConsistent ?? 0);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none overflow-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-xl shadow-xl max-h-[90vh] w-full max-w-2xl overflow-y-auto pointer-events-auto animate-fadeIn  scrollbar-hide"
        >
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-harvest-400 to-harvest-400 text-harvest-800 pt-[1rem] p-6 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{log.lead?.fullName}</h2>
              <p className="text-white text-sm mt-1 capitalize">{log.lead?.soulState?.split("_").join(" ").toLowerCase()}</p>
            </div>
            <button
              onClick={onClose}
              className="text-harvest-800 bg-white p-1 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Activity Info */}
            <div className="bg-white border border-slate-200 shadow-md rounded-lg p-4">
              <h3 className="font-bold text-harvest-600 mb-3">Activity Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">Activity Type:</span>
                  <span className="font-semibold text-earth-500">{AUDIT_TYPE_LABELS[log.type] || log.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">Time:</span>
                  <span className="font-semibold text-slate-500">{format(new Date(log.createdAt), "MMM d, yyyy HH:mm:ss")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold font-bold">Created By:</span>
                  <span className="font-semibold text-slate-500">{log.user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">Role:</span>
                  <span className="font-semibold text-slate-500">{log.user?.role}</span>
                </div>

                {/* Field-Specific Info */}
                {log.type === "FIELD_CHANGE" && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="text-slate-600">Field:</span>
                      <span className="font-mono text-slate-700">{log.fieldName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Old Value:</span>
                      <span className="font-mono text-red-600">{log.oldValue || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">New Value:</span>
                      <span className="font-mono text-green-600">{log.newValue || "—"}</span>
                    </div>
                  </>
                )}

                {log.type === "STATUS_CHANGE" && (
                  <>
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="text-slate-600">Old Status:</span>
                      <span className="font-semibold text-orange-600">{LEAD_STATUS_LABELS[log.oldValue as keyof typeof LEAD_STATUS_LABELS] || log.oldValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">New Status:</span>
                      <span className="font-semibold text-green-600">{LEAD_STATUS_LABELS[log.newValue as keyof typeof LEAD_STATUS_LABELS] || log.newValue}</span>
                    </div>
                  </>
                )}

                {log.type === "NOTE" && (
                  <div className="pt-2 border-t border-blue-200">
                    <div className="text-slate-600 mb-2 font-bold">Note Content:</div>
                    <div className="bg-slate-50 border border-blue-100 rounded p-3 text-slate-700 whitespace-pre-wrap text-sm">
                      {log.noteContent}
                    </div>
                  </div>
                )}

                {log.type === "ASSIGNMENT" && (
                  <div className="pt-2 border-t border-blue-200">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Assigned To:</span>
                      <span className="font-semibold text-slate-700">{log.details?.assignedToUserName || "Unassigned"}</span>
                    </div>
                  </div>
                )}

                {log.type === "SMS_SENT" && (
                  <div className="pt-2 border-t border-blue-200">
                    <div className="flex justify-between">
                      <span className="text-slate-600">SMS Type:</span>
                      <span className="font-semibold text-slate-700">{log.details?.smsType}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-slate-600">Recipient Phone:</span>
                      <span className="font-mono text-slate-700">{log.details?.recipientPhone}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lead Details Card */}
            <div className="bg-harvest-50 border border-harvest-200 rounded-lg p-4">
              <h3 className="font-bold text-harvest-500 mb-3">Lead's Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-600">Full Name</div>
                  <div className="font-semibold text-slate-800">{log.lead?.fullName}</div>
                </div>
                <div>
                  <div className="text-slate-600">Phone</div>
                  <div className="font-semibold text-slate-800">{log.lead?.phone || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Location</div>
                  <div className="font-semibold text-slate-800">{log.lead?.location}</div>
                </div>
                <div>
                  <div className="text-slate-600">Age Range</div>
                  <div className="font-semibold text-slate-800">{AGE_RANGE_LABELS[log.lead?.ageRange as keyof typeof AGE_RANGE_LABELS] || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Gender</div>
                  <div className="font-semibold text-slate-800">{log.lead?.gender || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Soul State</div>
                  <div className="font-semibold text-slate-800">{SOUL_STATE_LABELS[log.lead?.soulState as keyof typeof SOUL_STATE_LABELS] || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Status</div>
                  <div className="font-semibold text-slate-800">{LEAD_STATUS_LABELS[log.lead?.status as keyof typeof LEAD_STATUS_LABELS] || "—"}</div>
                </div>
                <div>
                  <div className="text-slate-600">Address</div>
                  <div className="font-semibold text-slate-800">{log.lead?.address || "—"}</div>
                </div>
              </div>
            </div>

            {/* Followup Member Info */}
            {log.lead?.assignedTo && (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h3 className="font-bold text-harvest-500 mb-3">Assigned Followup</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Name:</span>
                    <span className="font-semibold text-slate-800">{log.lead?.assignedTo?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Email:</span>
                    <span className="font-semibold text-slate-800">{log.lead?.assignedTo?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Phone:</span>
                    <span className="font-semibold text-slate-800">{log.lead?.assignedTo?.phone || "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {!log.lead?.assignedTo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">Not Assigned</span> - This lead has not been assigned to a followup member yet.
                </p>
              </div>
            )}

            {/* Church Information */}
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <h3 className="font-bold text-harvest-500 mb-3">Church Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Church Membership:</span>
                  <span className="font-semibold text-slate-800">
                    {CHURCH_LABELS[log.lead?.churchMembership as keyof typeof CHURCH_LABELS] || "Not specified"}
                  </span>
                </div>
                {log.lead?.churchName && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Church Name:</span>
                    <span className="font-semibold text-slate-800">{log.lead?.churchName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Months Consistent:</span>
                  <span className="font-semibold text-slate-800">{log.lead?.monthsConsistent ?? 0} months</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Attendance Status:</span>
                  <span className={`px-2 py-1 rounded text-white font-semibold text-xs ${att.bg}`}>{att.label}</span>
                </div>
              </div>
            </div>

            {/* Added By Info */}
            <div className="bg-white border border-harvest-400 rounded-lg p-4">
              <h3 className="font-bold text-harvest-500 mb-3">Added By</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Evangelist:</span>
                  <span className="font-semibold text-slate-800">{log.lead?.addedBy?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Email:</span>
                  <span className="font-semibold text-slate-800">{log.lead?.addedBy?.email}</span>
                </div>
              </div>
            </div>
 
          </div>
        </div>
      </div>
    </>
  );
}
