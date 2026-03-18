// app/dashboard/admin/sms-settings/page.tsx
"use client";
import { useState, useEffect } from "react";
import { Edit2, Save, X, Copy, Check, Phone, Users, Plus } from "lucide-react";

interface SMSTemplate {
  id: string;
  type: string;
  title: string;
  content: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  adminPhones: Array<{
    id: string;
    phone: string;
  }>;
}

// Template metadata with descriptions and placeholders
const TEMPLATE_INFO: Record<
  string,
  { description: string; placeholders: string[] }
> = {
  NEW_LEAD_NOTIFICATION: {
    description: "Sent to newly added leads 1 hour after record creation",
    placeholders: ["{leadName}", "{location}"],
  },
  ADMIN_ALERT: {
    description: "Sent to all admins immediately when a new lead is added",
    placeholders: ["{leadName}", "{phone}", "{location}", "{status}"],
  },
  FOLLOWUP_ASSIGNMENT: {
    description: "Sent to followup member when a lead is assigned to them",
    placeholders: ["{assigneeName}", "{leadName}", "{location}", "{phone}"],
  },
};

const SMSSettingsPage = () => {
  const [templates, setTemplates] = useState<SMSTemplate[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"templates" | "users">("templates");
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
  });
  const [phoneData, setPhoneData] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState<string>("");

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/sms-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      setTemplates(data);
      setError("");
    } catch (err) {
      setError("Failed to load SMS templates");
      console.error(err);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch admins");
      const data = await res.json();
      setUsers(data);
      setError("");
    } catch (err) {
      setError("Failed to load admin users");
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchTemplates(), fetchUsers()]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // Open edit mode
  const openEdit = (template: SMSTemplate) => {
    setFormData({
      title: template.title,
      content: template.content,
    });
    setEditingType(template.type);
    setError("");
    setSuccess("");
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingType(null);
    setFormData({ title: "", content: "" });
  };

  // Save template
  const handleSave = async (templateType: string) => {
    // setLoading(true);
    if (!formData.title.trim() || !formData.content.trim()) {
      setError("Title and content are required");
      return;
    }

    try {
      const res = await fetch(`/api/admin/sms-templates/${templateType}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save template");
      }

      setSuccess("Template updated successfully!");
      setEditingType(null);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, templateType: string) => {
    navigator.clipboard.writeText(text);
    setCopied(templateType);
    setTimeout(() => setCopied(""), 2000);
  };

  // Save user phone number
  const handleAddPhone = async (adminId: string) => {
    const phone = phoneData[adminId]?.trim();
    if (!phone) {
      setError("Phone number is required");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${adminId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add phone");
      }

      setSuccess("Phone number added successfully!");
      setEditingUserId(null);
      setPhoneData({ ...phoneData, [adminId]: "" });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add phone");
    }
  };

  const handleDeletePhone = async (adminId: string, phoneId: string) => {
    if (!confirm("Are you sure you want to delete this phone number?")) return;

    try {
      const res = await fetch(
        `/api/admin/users/${adminId}/phones?phoneId=${phoneId}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete phone");
      }

      setSuccess("Phone number deleted successfully!");
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete phone");
    }
  };

  // Get template info
  const getTemplateInfo = (type: string) =>
    TEMPLATE_INFO[type as keyof typeof TEMPLATE_INFO];

  // Format template type to readable name
  const formatTypeName = (type: string) => type.split("_").join(" ");

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6">
        <h1 className="page-title">SMS & Notifications Settings</h1>
        <p className="page-subtitle">
          Manage SMS templates and team member contact information
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-2 text-sm md:px-4 md:py-3 border-b-2 transition ${
            activeTab === "templates"
              ? "border-harvest-500 text-harvest-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Copy size={16} /> SMS Templates
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 text-sm md:px-4 md:py-3 border-b-2 transition ${
            activeTab === "users"
              ? "border-harvest-500 text-harvest-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Phone size={16} /> Admin Phone Numbers
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-200/20 text-red-500 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-200/20 text-green-500 rounded-lg">
          {success}
        </div>
      )}

      {/* SMS Templates Tab */}
      {activeTab === "templates" && (
        <div className="grid gap-6">
        {templates.map((template) => {
          const info = getTemplateInfo(template.type);
          const isEditing = editingType === template.type;

          return (
            <div
              key={template.type}
              className="bg-white border border-slate-200 rounded-lg p-6"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-harvest-600 mb-1">
                    {formatTypeName(template.type)}
                  </h3>
                  <p className="text-slate-700 text-sm">{info?.description}</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => openEdit(template)}
                    className="p-2 bg-harvest-500 rounded-lg transition ml-4"
                    title="Edit"
                  >
                    <Edit2 size={18} className="text-white" />
                  </button>
                )}
              </div>

              {/* Available Placeholders */}
              <div className="mb-4 p-3 bg-white rounded-lg border border-slate-300/50">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Available Placeholders:
                </p>
                <div className="flex flex-wrap gap-2">
                  {info?.placeholders.map((placeholder) => (
                    <code
                      key={placeholder}
                      className="text-xs bg-harvest-800 text-slate-50 px-2 py-1 rounded font-mono"
                    >
                      {placeholder}
                    </code>
                  ))}
                </div>
              </div>

              {isEditing ? (
                /* Edit Mode */
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="harvest-input w-full"
                      maxLength={200}
                    />
                    <div className="text-xs text-slate-500 mt-1">
                      {formData.title.length}/200
                    </div>
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
                      className="harvest-input w-full h-32 resize-none font-mono text-sm"
                      maxLength={2000}
                    />
                    <div className="text-xs text-slate-400 mt-1">
                      {formData.content.length}/2000
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>
                      <span className="text-slate-400">Created by:</span>{" "}
                      {template.createdBy.name}
                    </p>
                    <p>
                      <span className="text-slate-400">Last updated:</span>{" "}
                      {new Date(template.updatedAt).toLocaleDateString()} at{" "}
                      {new Date(template.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleSave(template.type)}
                      className="harvest-btn-primary flex items-center text-sm gap-1 md:gap-2 flex-1"
                    >
                      {loading ? (
                        <div role="status">
                          <svg
                            aria-hidden="true"
                            className="w-4 h-4 me-2 text-neutral-tertiary animate-spin fill-brand"
                            viewBox="0 0 100 101"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                              fill="currentColor"
                            />
                            <path
                              d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                              fill="currentFill"
                            />
                          </svg>
                          <span className="sr-only">Loading...</span>
                        </div>
                      ) : (
                        <Save size={18} />
                      )}{" "}
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="harvest-btn-secondary flex items-center gap-2 flex-1"
                    >
                      <X size={18} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Title</p>
                    <p className="text-slate-600 bg-slate-200/50 p-2 rounded text-sm">
                      {template.title}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      Content Preview
                    </p>
                    <div className="text-sm text-slate-600 bg-slate-200/50 p-3 rounded whitespace-pre-wrap break-words font-mono max-h-40 overflow-y-auto">
                      {template.content}
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="text-xs text-slate-500 space-y-1">
                    <p>
                      <span className="text-slate-400">Created by:</span>{" "}
                      {template.createdBy.name}
                    </p>
                    <p>
                      <span className="text-slate-400">Last updated:</span>{" "}
                      {new Date(template.updatedAt).toLocaleDateString()} at{" "}
                      {new Date(template.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={() =>
                      copyToClipboard(template.content, template.type)
                    }
                    className="w-full harvest-btn-secondary text-sm flex items-center justify-center gap-2 mt-2"
                  >
                    {copied === template.type ? (
                      <>
                        <Check size={16} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} /> Copy Content
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {/* Admin Phone Numbers Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {users.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No admins found
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((admin) => (
                <div
                  key={admin.id}
                  className="bg-white border border-slate-200 rounded-lg p-4"
                >
                  <div className="mb-4">
                    <h4 className="font-semibold text-slate-900">{admin.name}</h4>
                    <p className="text-sm text-slate-500">{admin.email}</p>
                  </div>

                  {/* Phone Numbers List */}
                  <div className="space-y-2 mb-4">
                    {admin.adminPhones && admin.adminPhones.length > 0 ? (
                      admin.adminPhones.map((adminPhone) => (
                        <div
                          key={adminPhone.id}
                          className="flex items-center justify-between bg-slate-50 p-3 rounded-lg"
                        >
                          <code className="text-sm text-slate-700 font-mono">
                            {adminPhone.phone}
                          </code>
                          <button
                            onClick={() => handleDeletePhone(admin.id, adminPhone.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Remove phone"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-400 italic">No phone numbers added</p>
                    )}
                  </div>

                  {/* Add Phone Form */}
                  {editingUserId === admin.id ? (
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={phoneData[admin.id] || ""}
                        onChange={(e) =>
                          setPhoneData({ ...phoneData, [admin.id]: e.target.value })
                        }
                        placeholder="+234 XXX XXX XXXX"
                        className="harvest-input flex-1"
                      />
                      <button
                        onClick={() => handleAddPhone(admin.id)}
                        className="p-2 bg-harvest-500 text-white rounded-lg hover:bg-harvest-600"
                        title="Add"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        onClick={() => setEditingUserId(null)}
                        className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        title="Cancel"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingUserId(admin.id)}
                      className="w-full harvest-btn-secondary text-sm flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Add Phone Number
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 p-4 bg-white border border-slate-200/50 rounded-lg">
            <h3 className="font-semibold text-earth-600 mb-2">Admin Phone Numbers</h3>
            <ul className="text-sm text-slate-500 space-y-1">
              <li>• Add multiple phone numbers per admin</li>
              <li>• Admins receive SMS alerts when new leads are added</li>
              <li>• Use international or local format (0XXXXXXXXXX)</li>
              <li>• Numbers will be normalized to Nigeria format (234XXXXXXXXX) for SMS</li>
            </ul>
          </div>
        </div>
      )}

      {/* Helper Section for Templates */}
      {activeTab === "templates" && (
      <div className="mt-8 p-4 bg-white border border-slate-200/50 rounded-lg">
        <h3 className="font-semibold text-earth-600 mb-2">Tips</h3>
        <ul className="text-sm text-slate-500 space-y-1">
          <li>• Use placeholders like {"{leadName}"} in your templates</li>
          <li>• Templates are sent automatically based on triggers</li>
          <li>
            • Maximum content length: 2000 characters (SMS limit ~160 chars per
            message)
          </li>
          <li>
            • Changes are saved immediately and apply to all future messages
          </li>
        </ul>
      </div>
      )}
    </div>
  );
};

export default SMSSettingsPage;
