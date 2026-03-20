// app/auth/forgot-password/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true); 

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-harvest-950 via-earth-900 to-harvest-900 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 60%, #ff9d37 0%, transparent 50%),
                              radial-gradient(circle at 75% 25%, #ffc070 0%, transparent 40%)`,
          }}
        />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-harvest-500 shadow-lg mb-4">
            {/* <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9 text-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 4C20 4 8 12 8 22C8 28.627 13.373 34 20 34C26.627 34 32 28.627 32 22C32 12 20 4 20 4Z" fill="currentColor" opacity="0.9"/>
              <path d="M20 10C20 10 14 16 14 22C14 25.314 16.686 28 20 28C23.314 28 26 25.314 26 22C26 16 20 10 20 10Z" fill="white" opacity="0.3"/>
              <path d="M20 34V38M17 36H23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg> */}
          </div>
          <div className="text-center mb-8"> 
          <div className="inline-flex items-center justify-center w-24 h-25 rounded-2xl bg-harvest-500 shadow-lg overflow-hidden mb-4">
            
            <img src="/applogo.jpg" alt="The Harvest Logo" className="w-full h-full object-cover" />
          </div>
          <p className="text-harvest-300 text-sm mt-1">Sign in to your account</p>
        </div>
          <p className="text-harvest-300 text-sm mt-1">Password Recovery</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-white mb-1">Forgot your password?</h2>
                <p className="text-harvest-300 text-sm leading-relaxed">
                  Enter the email address linked to your account and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-harvest-200 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-harvest-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-harvest-500 hover:bg-harvest-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-harvest-500/30"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/20 border border-green-400/30 mb-5">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">Check your inbox</h2>
              <p className="text-harvest-300 text-sm leading-relaxed mb-1">
                If an account exists for <span className="text-harvest-200 font-semibold">{email}</span>, we've sent a password reset link.
              </p>
              <p className="text-harvest-400 text-xs mt-3">
                The link expires in 1 hour. Check your spam folder if you don't see it.
              </p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-white/10">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-harvest-300 hover:text-harvest-200 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
