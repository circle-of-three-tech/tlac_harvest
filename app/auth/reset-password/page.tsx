// app/auth/reset-password/page.tsx
"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, CheckCircle, XCircle, Lock } from "lucide-react";

export default function ResetPasswordPage() {
 
return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-harvest-950 via-earth-900 to-harvest-900">
        <div className="text-harvest-300 text-sm">Loading...</div>
      </div>
    }>
      <PasswordResetForm />
    </Suspense>
  );
 
}


const PasswordResetForm = () =>{
   const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new one.");
    }
  }, [token]);

  const passwordStrength = (pw: string) => {
    if (pw.length === 0) return null;
    if (pw.length < 6) return { label: "Too short", color: "bg-red-400", width: "w-1/4" };
    if (pw.length < 8) return { label: "Weak", color: "bg-orange-400", width: "w-2/4" };
    if (pw.length < 12 || !/[0-9]/.test(pw)) return { label: "Fair", color: "bg-yellow-400", width: "w-3/4" };
    return { label: "Strong", color: "bg-green-400", width: "w-full" };
  };

  const strength = passwordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: form.password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Something went wrong. Please try again.");
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 3000);
    }
  };
   return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-harvest-950 via-earth-900 to-harvest-900 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-0 w-full h-full opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 60% 40%, #ff9d37 0%, transparent 50%),
                              radial-gradient(circle at 20% 70%, #ffc070 0%, transparent 40%)`,
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
            <h1 className="font-display text-3xl font-bold text-white mb-4">Welcome</h1>
          <div className="inline-flex items-center justify-center w-24 h-25 rounded-2xl bg-harvest-500 shadow-lg overflow-hidden mb-4">
            
            <img src="/applogo.jpg" alt="The Harvest Logo" className="w-full h-full object-cover" />
          </div>
          <p className="text-harvest-300 text-sm mt-1">Sign in to your account</p>
        </div>
          <p className="text-harvest-300 text-sm mt-1">Set New Password</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
          {success ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/20 border border-green-400/30 mb-5">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">Password Updated!</h2>
              <p className="text-harvest-300 text-sm leading-relaxed">
                Your password has been reset successfully. Redirecting you to sign in...
              </p>
              <Link href="/auth/login" className="inline-block mt-4 text-harvest-400 hover:text-harvest-300 text-sm underline underline-offset-2">
                Go to Sign In
              </Link>
            </div>
          ) : !token ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 border border-red-400/30 mb-5">
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-white mb-2">Invalid Link</h2>
              <p className="text-harvest-300 text-sm leading-relaxed mb-4">
                This reset link is invalid or has expired.
              </p>
              <Link href="/auth/forgot-password" className="harvest-btn-primary inline-flex text-sm">
                Request New Link
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-white mb-1">Create new password</h2>
                <p className="text-harvest-300 text-sm">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-harvest-200 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-harvest-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 characters"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-11 py-3 text-white placeholder:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-harvest-400 hover:text-harvest-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength meter */}
                  {strength && (
                    <div className="mt-2">
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                      </div>
                      <p className="text-xs text-harvest-400 mt-1">{strength.label}</p>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-harvest-200 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-harvest-400" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      required
                      value={form.confirm}
                      onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder="Repeat your password"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-11 py-3 text-white placeholder:text-harvest-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-harvest-400 hover:text-harvest-200"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.confirm && form.password !== form.confirm && (
                    <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                  )}
                  {form.confirm && form.password === form.confirm && (
                    <p className="text-xs text-green-400 mt-1">✓ Passwords match</p>
                  )}
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
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </>
          )}

          {!success && (
            <div className="mt-6 pt-5 border-t border-white/10">
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-2 text-harvest-300 hover:text-harvest-200 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}