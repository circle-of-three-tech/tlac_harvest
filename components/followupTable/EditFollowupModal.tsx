"use client";
import { useState, useEffect } from "react";
import { CircleX, X, AlertCircle, Save, Trash2 } from "lucide-react";

const GENDER_OPTIONS = [
  { value: "", label: "No Gender" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

const ALL_ROLES = [
  { value: "EVANGELIST", label: "Evangelist" },
  { value: "FOLLOWUP", label: "Follow-Up" },
  { value: "ADMIN", label: "Admin" },
];

interface FollowupMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  role: string;
  roles: string[];
  noOfSoulsTarget?: number;
}

export default function EditFollowupModal({
  isOpen,
  onClose,
  followupMemberId,
  onSuccess,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  followupMemberId: string;
  onSuccess: (updatedFollowupMember: FollowupMember) => void;
  onDelete?: (followupMemberId: string) => void;
}) {
  const [form, setForm] = useState<FollowupMember>({
    id: "",
    name: "",
    email: "",
    phone: "",
    role: "FOLLOWUP",
    roles: ["FOLLOWUP"],
    gender: "",
    noOfSoulsTarget: 0,
  });
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchUser = async (id: string) => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch user details");
      }
      const data = await res.json();
      // Normalise: if roles array is empty, fall back to single role
      if (!data.roles || data.roles.length === 0) {
        data.roles = [data.role];
      }
      setForm(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (followupMemberId && isOpen) {
      fetchUser(followupMemberId);
    }
  }, [followupMemberId, isOpen]);

  const toggleRole = (role: string) => {
    const current = form.roles ?? [];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    // Always keep at least one role
    if (next.length === 0) return;
    setForm({ ...form, roles: next });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/users/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          roles: form.roles,
          gender: form.gender || null,
          noOfSoulsTarget: form.noOfSoulsTarget,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user");
      }

      const updated = await res.json();
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setError("");
    setDeleting(true);

    try {
      const res = await fetch(`/api/users/${form.id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete user");
      }

      onDelete?.(form.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!isOpen || !followupMemberId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-2xl max-h-[90vh] overflow-y-auto animate-fadeIn">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-harvest-50">
          <h2 className="font-display font-bold text-slate-900 text-lg sm:text-xl">
            Edit User Details
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl bg-harvest-500 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="p-4 flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-harvest-500"></div>
            <p>Loading...</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="harvest-label">Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter full name"
                className="harvest-input"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="harvest-label">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Enter email address"
                className="harvest-input"
              />
            </div>

            <div className="col-span-1 sm:col-span-2">
              <label className="harvest-label">Phone</label>
              <input
                type="tel"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+234..."
                className="harvest-input"
              />
            </div>

            {/* Multi-role selector — admin only in UI context */}
            <div className="col-span-1 sm:col-span-2">
              <label className="harvest-label">Roles *</label>
              <div className="flex flex-wrap gap-3 mt-1">
                {ALL_ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      (form.roles ?? []).includes(r.value)
                        ? "bg-harvest-100 border-harvest-400 text-harvest-800"
                        : "bg-white border-slate-200 text-slate-500 hover:border-harvest-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-harvest-500"
                      checked={(form.roles ?? []).includes(r.value)}
                      onChange={() => toggleRole(r.value)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
              {(form.roles ?? []).length === 0 && (
                <p className="text-red-500 text-xs mt-1">At least one role is required.</p>
              )}
            </div>

            <div>
              <label className="harvest-label">Gender</label>
              <select
                value={form.gender || ""}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="harvest-select"
              >
                {GENDER_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="harvest-label">Souls Target</label>
              <input
                type="number"
                min="0"
                value={form.noOfSoulsTarget || 0}
                onChange={(e) =>
                  setForm({ ...form, noOfSoulsTarget: parseInt(e.target.value) })
                }
                placeholder="0"
                className="harvest-input"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-red-700 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 sm:px-4 py-3 sm:py-4 text-sm text-red-900">
              <p className="font-semibold mb-2">Permanently delete this user?</p>
              <p className="text-red-700 text-xs sm:text-sm mb-3">
                This action cannot be undone. Make sure they don't have any assigned leads.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="harvest-btn-danger text-white py-2 px-3 flex-1 text-sm disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="harvest-btn-secondary flex-1 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || (form.roles ?? []).length === 0}
              className="harvest-btn-primary flex-1 justify-center disabled:opacity-60 gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              {loading ? "Saving..." : "Save Changes"}
            </button>

            {onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={showDeleteConfirm}
                className="harvest-btn-danger text-white flex-1 justify-center gap-2 text-sm disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="harvest-btn-secondary flex-1 justify-center text-sm"
            >
              <CircleX className="w-4 h-4" /> Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
