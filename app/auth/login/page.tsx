// app/auth/login/page.tsx
"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, LogIn, AlertCircle, Wheat, EyeOff, Eye } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      {/* Decorative wheat pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, #ff9d37 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, #ffc070 0%, transparent 40%)`,
          }}
        />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo / Header */}
        <div className="text-center mb-8">
            {/* <h1 className="font-display text-3xl font-bold text-white mb-4">Welcome Back</h1> */}
          <div className="inline-flex items-center justify-center mb-4">
            {/* <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9 text-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4C20 4 8 12 8 22C8 28.627 13.373 34 20 34C26.627 34 32 28.627 32 22C32 12 20 4 20 4Z" fill="currentColor" opacity="0.9"/>
              <path d="M20 10C20 10 14 16 14 22C14 25.314 16.686 28 20 28C23.314 28 26 25.314 26 22C26 16 20 10 20 10Z" fill="white" opacity="0.3"/>
              <path d="M20 34V38M17 36H23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg> */}
            {/* <img src="/applogo.jpg" alt="The Harvest Logo" className="w-full h-full object-cover" /> */}
          <span className="flex gap-2 w-fit mx-auto items-center justify-center">
            <Wheat className="w-6 h-6 text-earth-500 mx-auto mb-2" />
            <h1 className="text-3xl w-fit font-bold text-transparent bg-clip-text bg-gradient-to-r from-earth-300 to-earth-600">
              TLAC Harvest
            </h1>
          </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
                <input
                   type={isPasswordVisible ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full bg-earth-50/20 border border-earth-100 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-earth-400 text-sm"
                />
                  <button
                  type="button"
                  onClick={() => setIsPasswordVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-earth-500 text-xs"
                >
                  {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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
              className="w-full bg-earth-400 hover:bg-earth-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-earth-500/30 mt-2 flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-earth-400 hover:text-earth-300 font-semibold underline underline-offset-2">
              Create one
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-400 text-xs mt-4">
          <Link href="/auth/forgot-password" className="text-earth-400 hover:text-earth-300 font-semibold underline underline-offset-2">Forgot Password? </Link>
        </p>
      </div>
    </div>
  );
}
