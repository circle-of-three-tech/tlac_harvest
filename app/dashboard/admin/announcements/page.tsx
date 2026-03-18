// app/dashboard/admin/announcements/page.tsx
"use client";
import { useState, useEffect } from "react";
import { CirclePlus, Trash2, Edit2, X } from "lucide-react";
import { set } from "date-fns";

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRole: "FOLLOWUP" | "EVANGELIST" | "ALL";
  expiryDate: string;
  hidden: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

const AnnouncementsPage = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    targetRole: "ALL" as "ALL" | "FOLLOWUP" | "EVANGELIST",
    expiryDate: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch announcements
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/announcements");
      if (!res.ok) throw new Error("Failed to fetch announcements");
      const data = await res.json();
      setAnnouncements(data);
      setError("");
    } catch (err) {
      setError("Failed to load announcements");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      targetRole: "ALL",
      expiryDate: "",
    });
    setEditingId(null);
    setError("");
  };

  // Open edit modal
  const openEdit = (announcement: Announcement) => {
    setFormData({
      title: announcement.title,
      content: announcement.content,
      targetRole: announcement.targetRole,
      expiryDate: new Date(announcement.expiryDate).toISOString().slice(0, 16),
    });
    setEditingId(announcement.id);
    setShowModal(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (
      !formData.title.trim() ||
      !formData.content.trim() ||
      !formData.expiryDate
    ) {
      setError("Please fill in all fields");
      return;
    }

    try {
      const method = editingId ? "PATCH" : "POST";
      const endpoint = editingId
        ? `/api/admin/announcements/${editingId}`
        : "/api/admin/announcements";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          expiryDate: new Date(formData.expiryDate).toISOString(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save announcement");
      }

      setSuccess(editingId ? "Announcement updated!" : "Announcement created!");
      resetForm();
      setShowModal(false);
      await fetchAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Delete announcement
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    try {
      setError("");
      setLoading(true);
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete announcement");

      setSuccess("Announcement deleted!");
      await fetchAnnouncements();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      FOLLOWUP: "Followup Team",
      EVANGELIST: "Evangelists",
      ALL: "Everyone",
    };
    return labels[role] || role;
  };

  const isExpired = (date: string) => new Date(date) < new Date();

  return (
    <div className="py-6">
      <div className="flex justify-between flex-col gap-2 sm:flex-row sm:items-center mb-6">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-subtitle">Manage announcements for your team</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="harvest-btn-primary flex items-center gap-2"
        >
          <CirclePlus size={20} /> New Announcement
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-200/20 text-red-500 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/20 text-green-600 rounded-lg">
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg">
          Loading...
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-lg">
          No announcements yet. Create one to get started!
        </div>
      ) : (
        <div className="grid gap-4">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className={`p-4 rounded-lg border ${
                isExpired(announcement.expiryDate)
                  ? "bg-white border-slate-200/50 opacity-60"
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg text-harvest-500">
                      {announcement.title}
                    </h3>
                    {isExpired(announcement.expiryDate) && (
                      <span className="text-xs bg-red-500/30 text-red-300 px-2 py-1 rounded">
                        Expired
                      </span>
                    )}
                    {announcement.hidden && (
                      <span className="text-xs bg-harvest-300 text-harvest-600 px-2 py-1 rounded">
                        Hidden
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm mt-1">
                    {announcement.content}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => openEdit(announcement)}
                    className="p-2 hover:bg-earth-700 bg-harvest-300 rounded-lg transition"
                    title="Edit"
                  >
                    <Edit2 size={18} className="text-white" />
                  </button>
                  <button
                    onClick={() => handleDelete(announcement.id)}
                    className="p-2 hover:bg-earth-700 bg-red-500 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 size={18} className="text-white" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-3">
                <div>
                  <span className="text-slate-500 font-bold">Target:</span>{" "}
                  {getRoleLabel(announcement.targetRole)}
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Expires:</span>{" "}
                  {new Date(announcement.expiryDate).toLocaleDateString()} at{" "}
                  {new Date(announcement.expiryDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div>
                  <span className="text-slate-500 font-bold">By:</span>{" "}
                  {announcement.createdBy.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {editingId ? "Edit Announcement" : "New Announcement"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 bg-harvest-500 text-white rounded"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="harvest-input w-full"
                  placeholder="Announcement title"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Content
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  className="harvest-input w-full h-32 resize-none"
                  placeholder="Announcement content"
                  maxLength={2000}
                />
                <div className="text-xs text-slate-500 mt-1">
                  {formData.content.length}/2000
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Target Audience
                  </label>
                  <select
                    value={formData.targetRole}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetRole: e.target.value as any,
                      })
                    }
                    className="harvest-input w-full"
                  >
                    <option value="ALL">Everyone</option>
                    <option value="FOLLOWUP">Followup Team</option>
                    <option value="EVANGELIST">Evangelists</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">
                    Expiry Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.expiryDate}
                    onChange={(e) =>
                      setFormData({ ...formData, expiryDate: e.target.value })
                    }
                    className="harvest-input w-full"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="harvest-btn-primary text-center flex-1"
                >
                  {editingId ? "Update" : "Create"}
                  {loading && (
                    <svg
                      className="animate-spin ml-2 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      width={16}
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="harvest-btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
