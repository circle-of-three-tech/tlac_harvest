// components/leads/LeadDetailModal.tsx
"use client";
import { useState, useEffect } from "react";
import { X, Trash2, Edit2, Send, Check } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  LEAD_STATUS_LABELS, SOUL_STATE_LABELS, AGE_RANGE_LABELS, GENDER_LABELS,
  CHURCH_LABELS, getAttendanceStatus, cn
} from "@/lib/utils";
import { format } from "date-fns";

const AGE_RANGES = ["UNDER_18","AGE_18_25","AGE_26_35","AGE_36_45","AGE_46_60","ABOVE_60"];
const SOUL_STATES = ["UNBELIEVER","NEW_CONVERT","UNCHURCHED_BELIEVER","HUNGRY_BELIEVER"];
const STATUSES = ["NEW_LEAD","FOLLOWING_UP","CONVERTED"];
const CHURCHES = ["TLAC","KSOD", "BOTH_TLAC_AND_KSOD","OTHERS"];

export default function LeadDetailModal({
  lead: initialLead,
  isAdmin,
  onClose,
  onUpdated,
  onDeleted,
}: {
  lead: any;
  isAdmin?: boolean;
  onClose: () => void;
  onUpdated?: (lead: any) => void;
  onDeleted?: (id: string) => void;
}) {
  const { data: session } = useSession();
  const [lead, setLead] = useState(initialLead);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [noteText, setNoteText] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [followups, setFollowups] = useState<any[]>([]);

  const role = (session?.user as any)?.role;
  const isFollowup = role === "FOLLOWUP";
  const canEdit = true;
  const canDelete = isAdmin;

  useEffect(() => {
    if (isAdmin && editing) {
      fetch("/api/users?role=FOLLOWUP&limit=100")
        .then(r => r.json())
        .then(d => setFollowups(d.users ?? []));
    }
  }, [isAdmin, editing]);

  const startEdit = () => {
    setEditForm({
      fullName: lead.fullName,
      ageRange: lead.ageRange,
      phone: lead.phone ?? "",
      address: lead.address ?? "",
      location: lead.location,
      additionalNotes: lead.additionalNotes ?? "",
      soulState: lead.soulState,
      status: lead.status,
      assignedToId: lead.assignedToId ?? "",
      churchMembership: lead.churchMembership ?? "",
      churchName: lead.churchName ?? "",
      monthsConsistent: lead.monthsConsistent ?? 0,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const body: any = { ...editForm };
    if (!body.assignedToId) delete body.assignedToId;
    if (!body.churchMembership) delete body.churchMembership;
    if (body.churchMembership !== "OTHERS") delete body.churchName;

    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setLead(data);
      setEditing(false);
      onUpdated?.(data);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    setDeleting(false);
    onDeleted?.(lead.id);
    onClose();
  };

  const handlePostNote = async () => {
    if (!noteText.trim()) return;
    setPostingNote(true);
    const res = await fetch(`/api/leads/${lead.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteText }),
    });
    const note = await res.json();
    setPostingNote(false);
    if (res.ok) {
      setLead((prev: any) => ({ ...prev, notes: [...(prev.notes ?? []), note] }));
      setNoteText("");
    }
  };

  const att = getAttendanceStatus(lead.monthsConsistent ?? 0);

  // console.log({"phone": lead})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-xl bg-harvest-100 flex items-center justify-center text-harvest-700 font-bold text-sm sm:text-base flex-shrink-0">
              {lead.fullName[0]}
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-slate-900 text-sm sm:text-base truncate">{lead.fullName}</h2>
              <div className="flex items-center gap-1 sm:gap-2 mt-0.5 flex-wrap md  :hidden sm:flex-nowrap  ">
                <span className={cn("badge text-xs",
                  lead.status === "NEW_LEAD" ? "badge-new" :
                  lead.status === "FOLLOWING_UP" ? "badge-following" : "badge-converted"
                )}>
                  {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS]}
                </span>
                {lead.monthsConsistent > 0 && (
                  <span className={cn("badge text-xs", att.bg, att.color)}>{att.label}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
            {canEdit && !editing && (
              <button onClick={startEdit} className="harvest-btn-secondary text-xs py-1 px-2 sm:px-3">
                <Edit2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            {canDelete && !confirmDelete && (
              <button onClick={() => setConfirmDelete(true)} className="harvest-btn-danger text-xs py-1 px-2 sm:px-3">
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-xs text-red-600 hidden sm:inline">Confirm?</span>
                <button onClick={handleDelete} disabled={deleting} className="harvest-btn-danger text-xs py-1 px-2">
                  {deleting ? "..." : "Yes, delete"}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="harvest-btn-secondary text-xs py-1 px-2">No</button>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 sm:p-2 rounded-xl hover:bg-harvest-50 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Lead details */}
          <div className="md:col-span-2 space-y-4 sm:space-y-6">
            {!editing ? (
              /* View mode */
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Age Range", value: AGE_RANGE_LABELS[lead.ageRange as keyof typeof AGE_RANGE_LABELS] },
                  { label: "Soul State", value: SOUL_STATE_LABELS[lead.soulState as keyof typeof SOUL_STATE_LABELS] },
                  { label: "Gender", value: GENDER_LABELS[lead.gender as keyof typeof GENDER_LABELS] },
                  { label: "Phone", value: lead.phone || "—" },
                  { label: "Location", value: lead.location },
                  { label: "Address", value: lead.address || "—" },
                  { label: "Added By", value: lead.addedBy?.name || "—", phone: lead.addedBy?.phone },
                  { label: "Assigned To", value: lead.assignedTo?.name || "Unassigned", phone: lead.assignedTo?.phone },
                  { label: "Added On", value: format(new Date(lead.createdAt), "MMM d, yyyy") },
                ].map(item => (
                  <div key={item.label}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{item.label}</div>
                    <div className="text-sm text-slate-700 mt-0.5 font-medium">{item.value}</div>
                    {item?.phone && (
                      <div className="text-xs text-slate-500 mt-1">Phone: {item.phone}</div>
                    )}
                  </div>
                ))}

                {lead.additionalNotes && (
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes From Evangelist</div>
                    <div className="text-xs sm:text-sm text-slate-700 mt-1 bg-harvest-50 rounded-xl p-2 sm:p-3">{lead.additionalNotes}</div>
                  </div>
                )}

                {/* Church info */}
                {lead.churchMembership && (
                  <div className="sm:col-span-2 bg-earth-50 rounded-xl p-3 sm:p-4">
                    <div className="font-semibold text-earth-800 text-xs sm:text-sm mb-2">⛪ Church Follow-Up</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <div className="text-xs text-earth-600">Church</div>
                        <div className="text-xs sm:text-sm font-medium text-earth-900">
                          {lead.churchMembership === "OTHERS" ? lead.churchName : CHURCH_LABELS[lead.churchMembership as keyof typeof CHURCH_LABELS]}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-earth-600">Months Consistent</div>
                        <div className="text-xs sm:text-sm font-medium text-earth-900">{lead.monthsConsistent ?? 0} month(s)</div>
                      </div>
                      <div>
                        <div className="text-xs text-earth-600">Attendance Status</div>
                        <span className={cn("badge text-xs", att.bg, att.color)}>{att.label}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Edit mode */
              <div className="space-y-3 sm:space-y-4">
                {!isFollowup && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="col-span-2">
                        <label className="harvest-label">Full Name</label>
                        <input value={editForm.fullName} onChange={e => setEditForm((f: any) => ({...f, fullName: e.target.value}))} className="harvest-input" />
                      </div>
                      <div>
                        <label className="harvest-label">Age Range</label>
                        <select value={editForm.ageRange} onChange={e => setEditForm((f: any) => ({...f, ageRange: e.target.value}))} className="harvest-select">
                          {AGE_RANGES.map(v => <option key={v} value={v}>{AGE_RANGE_LABELS[v as keyof typeof AGE_RANGE_LABELS]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="harvest-label">Soul State</label>
                        <select value={editForm.soulState} onChange={e => setEditForm((f: any) => ({...f, soulState: e.target.value}))} className="harvest-select">
                          {SOUL_STATES.map(v => <option key={v} value={v}>{SOUL_STATE_LABELS[v as keyof typeof SOUL_STATE_LABELS]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="harvest-label">Phone</label>
                        <input value={editForm.phone} onChange={e => setEditForm((f: any) => ({...f, phone: e.target.value}))} className="harvest-input" />
                      </div>
                      <div>
                        <label className="harvest-label">Location</label>
                        <input value={editForm.location} onChange={e => setEditForm((f: any) => ({...f, location: e.target.value}))} className="harvest-input" />
                      </div>
                      <div className="col-span-2">
                        <label className="harvest-label">Address</label>
                        <input value={editForm.address} onChange={e => setEditForm((f: any) => ({...f, address: e.target.value}))} className="harvest-input" />
                      </div>
                      <div className="col-span-2">
                        <label className="harvest-label">Notes From Evangelist</label>
                        <textarea rows={2} value={editForm.additionalNotes} onChange={e => setEditForm((f: any) => ({...f, additionalNotes: e.target.value}))} className="harvest-input resize-none" />
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <div>
                          <label className="harvest-label">Status</label>
                          <select value={editForm.status} onChange={e => setEditForm((f: any) => ({...f, status: e.target.value}))} className="harvest-select">
                            {STATUSES.map(v => <option key={v} value={v}>{LEAD_STATUS_LABELS[v as keyof typeof LEAD_STATUS_LABELS]}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="harvest-label">Assign To (Follow-Up)</label>
                          <select value={editForm.assignedToId} onChange={e => setEditForm((f: any) => ({...f, assignedToId: e.target.value}))} className="harvest-select">
                            <option value="">Unassigned</option>
                            {followups.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Church fields - available to all editors */}
                <div className={`border-t border-harvest-100 pt-3 sm:pt-4 ${role === "EVANGELIST" ? "hidden" : "flex"}`}>
                  <div className="font-semibold text-slate-800 text-xs sm:text-sm mb-2 sm:mb-3">⛪ Church Follow-Up Info</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    <div className="">
                      <label className="harvest-label">Church Membership</label>
                      <select value={editForm.churchMembership} onChange={e => setEditForm((f: any) => ({...f, churchMembership: e.target.value}))} className="harvest-select">
                        <option value="">None</option>
                        {CHURCHES.map(v => <option key={v} value={v}>{CHURCH_LABELS[v as keyof typeof CHURCH_LABELS]}</option>)}
                      </select>
                    </div>
                    
                    <div>
                      <label className="harvest-label">Months Consistent</label>
                      <input type="number" min={0} max={24} value={editForm.monthsConsistent} onChange={e => setEditForm((f: any) => ({...f, monthsConsistent: parseInt(e.target.value) || 0}))} className="harvest-input" />
                    </div>
                    {editForm.churchMembership === "OTHERS" && (
                      <div className="sm:col-span-2">
                        <label className="harvest-label">Name of Church *</label>
                        <input required value={editForm.churchName} onChange={e => setEditForm((f: any) => ({...f, churchName: e.target.value}))} className="harvest-input" placeholder="Enter church name" />
                      </div>
                    )}
                  </div>
                </div>

                <div className={`flex flex-row sm:flex-row gap-1 sm:gap-2 pt-2 `}>
                  <button type="button" onClick={handleSave} disabled={saving} className="harvest-btn-primary flex-1 justify-center disabled:opacity-60 text-sm">
                    <Check className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className="harvest-btn-secondary flex-1 text-sm text-center">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Notes */}
          <div className="md:col-span-1 space-y-3 sm:space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm">Followup Notes & Updates</h3>
            <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
              {(lead.notes ?? []).length === 0 && (
                <p className="text-xs text-slate-400 italic">No notes yet.</p>
              )}
              {(lead.notes ?? []).map((note: any) => (
                <div key={note.id} className="bg-harvest-50 rounded-lg p-2 sm:p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-5 h-5 rounded-full bg-harvest-200 flex items-center justify-center text-harvest-700 text-xs font-bold flex-shrink-0">
                      {note.user?.name?.[0] ?? "?"}
                    </div>
                    <span className="text-xs font-semibold text-slate-700 truncate">{note.user?.name}</span>
                    <span className="text-xs text-slate-400 ml-auto flex-shrink-0">{format(new Date(note.createdAt), "MMM d")}</span>
                  </div>
                  <p className="text-xs text-slate-700">{note.content}</p>
                </div>
              ))}
            </div>

            {/* Add note */}
            {role !== "EVANGELIST" && (<div className="border-t border-harvest-100 pt-2 sm:pt-3">
              <textarea
                rows={2}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="harvest-input resize-none text-xs"
                onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handlePostNote(); }}
              />
              <button
                onClick={handlePostNote}
                disabled={postingNote || !noteText.trim()}
                className="harvest-btn-primary w-full justify-center mt-2 text-xs disabled:opacity-50 gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{postingNote ? "Posting..." : "Post Note"}</span>
                <span className="sm:hidden">{postingNote ? "..." : "Post"}</span>
              </button>
            </div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
