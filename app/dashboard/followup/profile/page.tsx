// app/dashboard/followup/profile/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { User, Mail, Phone, AlertCircle, CheckCircle, Users } from "lucide-react";

export default function FollowupProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    gender: "",
    phone: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated" && session?.user?.role !== "FOLLOWUP") {
      router.push("/dashboard");
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/users/profile");
        const data = await res.json();

        if (res.ok) {
          setForm({
            name: data.user.name || "",
            email: data.user.email || "",
            phone: data.user.phone || "",
            gender: data.user.gender || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
        setMessage({ type: "error", text: "Failed to load profile" });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Failed to update profile",
        });
      } else {
        setMessage({
          type: "success",
          text: "Profile updated successfully!",
        });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" bg-white>
        <div className="text-slate-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen mt-6 py-4 md:p-8 bg-white">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <h1 className="text-2xl md:text-3xl text-center font-bold text-harvest-400 rounded-lg overflow-hidden">
            Edit Profile
          </h1>
        </div>

        {/* Cards Container */}
        <div className="grid gap-6">
          {/* Form Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-harvest-400" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Your full name"
                    className="w-full bg-white border border-slate-400/20 rounded-xl pl-10 pr-4 py-3 text-slate-600 placeholder:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-harvest-400" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="your@email.com"
                    className="w-full bg-white/10 border border-slate-400/20 rounded-xl pl-10 pr-4 py-3 text-slate-600 placeholder:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                  />
                </div>
              </div>
              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Gender
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-harvest-400" />
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gender: e.target.value }))
                    }
                    className="w-full bg-white/10 border border-slate-400/20 rounded-xl pl-10 pr-4 py-3 text-slate-600 placeholder:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                  >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-harvest-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    placeholder="+234 XXX XXX XXXX"
                    className="w-full bg-white border border-slate-400/20 rounded-xl pl-10 pr-4 py-3 text-slate-600 placeholder:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                  />
                </div>
              </div>

              {/* Messages */}
              {message && (
                <div
                  className={`rounded-xl px-4 py-3 flex items-center gap-2 text-sm border ${
                    message.type === "success"
                      ? "bg-green-300/20 border-green-400/30 text-green-500"
                      : "bg-red-300/20 border-red-400/30 text-red-500"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-fit bg-harvest-500 hover:bg-harvest-400 disabled:opacity-60 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg shadow-harvest-500/30"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Info Card */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <p className="text-harvest-500 text-sm">
              💡 Keep your contact information up to date so the team can reach
              you easily.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
