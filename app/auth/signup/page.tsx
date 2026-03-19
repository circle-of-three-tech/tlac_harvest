// app/auth/signup/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Mail,
  Lock,
  LogIn,
  AlertCircle,
  Zap,
  HeartHandshake,
  Phone,
  Users,
  Target,
  Wheat,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    gender: "",
    phone: "",
    noOfSoulsTarget: "",
    role: "EVANGELIST",
  });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong");
    } else {
      router.push("/auth/login?registered=1");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 70% 70%, #ff9d37 0%, transparent 50%),
                                radial-gradient(circle at 20% 30%, #ffc070 0%, transparent 40%)`,
          }}
        />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          {/* <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-earth-500 shadow-lg mb-4"> */}
          {/* <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9 text-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4C20 4 8 12 8 22C8 28.627 13.373 34 20 34C26.627 34 32 28.627 32 22C32 12 20 4 20 4Z" fill="currentColor" opacity="0.9"/>
              <path d="M20 10C20 10 14 16 14 22C14 25.314 16.686 28 20 28C23.314 28 26 25.314 26 22C26 16 20 10 20 10Z" fill="white" opacity="0.3"/>
              <path d="M20 34V38M17 36H23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg> */}
          {/* </div> */}

          <div className="text-center mt-8 mb-4">
            {/* <h1 className="font-display text-3xl font-bold text-white mb-4">Get Started</h1> */}
            {/* <div className="inline-flex items-center justify-center w-24 h-25 rounded-2xl bg-earth-500 shadow-lg overflow-hidden mb-4">
            
            <img src="/applogo.jpg" alt="The Harvest Logo" className="w-full h-full object-cover" />
          </div> */}
          </div>
          <span className="flex gap-2 w-fit mx-auto items-center justify-center">
            <Wheat className="w-6 h-6 text-earth-500 mx-auto mb-2" />
            <h1 className="text-3xl w-fit font-bold text-transparent bg-clip-text bg-gradient-to-r from-earth-300 to-earth-600">
              TLAC Harvest
            </h1>
          </span>
          <p className="text-slate-600 text-xl mt-1">Create Your Account</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-500" />
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="John Doe"
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-500" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="you@example.com"
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-500" />
                <input
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+234 XXX XXX XXXX"
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                />
              </div>
            </div>

          {form.role === "EVANGELIST" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                No. of Souls Target
              </label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-500" />
                <input
                  type="number"
                  required={ form.role === "EVANGELIST" ? true : false }
                  value={form.noOfSoulsTarget}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, noOfSoulsTarget: e.target.value }))
                  }
                  placeholder="e.g., 100"
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                />
              </div>
            </div>  
          )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Gender
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-500" />
                <select
                  required
                  value={form.gender}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, gender: e.target.value }))
                  }
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                >
                  <option value="" className="text-earth-400">
                    Gender
                  </option>
                  <option className="text-slate-600" value="MALE">
                    Male
                  </option>
                  <option className="text-slate-600" value="FEMALE">
                    Female
                  </option>
                </select>
              </div>
            </div>


            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-500" />
                <input
                  type={isPasswordVisible ? "text" : "password"}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  placeholder="Min. 6 characters"
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-earth-500 text-xs"
                >
                  {isPasswordVisible ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white mb-1.5">
                Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: "EVANGELIST",
                    label: "Evangelist (Harvester)",
                    desc: "Add new leads",
                    icon: Zap,
                  },
                  {
                    value: "FOLLOWUP",
                    label: "Follow-Up",
                    desc: "Disciple leads",
                    icon: HeartHandshake,
                  },
                ].map((opt) => {
                  const RoleIcon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, role: opt.value }))
                      }
                      className={`rounded-xl p-3 text-left transition-all flex items-start gap-2 ${
                        form.role === opt.value
                          ? "bg-earth-100 text-earth-500"
                          : "bg-white text-earth-500"
                      }`}
                    >
                      <RoleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs opacity-70 mt-0.5">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="bg-red-300/20 border border-red-400/30 rounded-xl px-4 py-3 flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-earth-500 hover:bg-earth-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-earth-500/30 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-earth-400 hover:text-earth-300 font-semibold underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
