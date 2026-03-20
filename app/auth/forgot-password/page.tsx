// app/auth/forgot-password/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle, Wheat } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <span className="flex gap-2 w-fit mx-auto items-center justify-center">
              <Wheat className="w-6 h-6 text-earth-500 mx-auto mb-2" />
              <h1 className="text-3xl w-fit font-bold text-transparent bg-clip-text bg-gradient-to-r from-earth-300 to-earth-600">
                TLAC Harvest
              </h1>
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Password Recovery</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-earth-500 mb-1">
                  Forgot your password?
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Enter the email address linked to your account and we'll send
                  you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
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
                  className="w-full bg-earth-500 hover:bg-earth-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-harvest-500/30"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-earth-500/20 border border-earth-400/30 mb-5">
                <CheckCircle className="w-8 h-8 text-earth-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">
                Check your inbox
              </h2>
              <p className="text-earth-500 text-sm leading-relaxed mb-1">
                If an account exists for{" "}
                <span className="text-slate-500 font-semibold">{email}</span>,
                we've sent a password reset link.
              </p>
              <p className="text-slate-400 text-xs mt-3">
                The link expires in 1 hour. Check your spam folder if you don't
                see it.
              </p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-white/10">
            <Link
              href="/auth/login"
              className="flex items-center justify-center gap-2 text-earth-300 hover:text-harvest-200 text-sm font-medium transition-colors"
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
