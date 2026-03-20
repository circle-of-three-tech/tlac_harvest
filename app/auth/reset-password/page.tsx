// app/auth/reset-password/page.tsx
"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, CheckCircle, XCircle, Lock, Wheat } from "lucide-react";

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
    <div className="relative min-h-screen flex items-center justify-center bg-white p-4">
      
        <div className="">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <span className="flex gap-2 w-fit mx-auto items-center justify-center">
              <Wheat className="w-6 h-6 text-earth-500 mx-auto mb-2" />
              <h1 className="text-3xl w-fit font-bold text-transparent bg-clip-text bg-gradient-to-r from-earth-300 to-earth-600">
                TLAC Harvest
              </h1>
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">Set New Password</p>
        </div> 

        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 shadow-2xl">
          {success ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/20 border border-green-400/30 mb-5">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-slate-500 mb-2">Password Updated!</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Your password has been reset successfully. Redirecting you to sign in...
              </p>
              {/* <Link href="/auth/login" className="inline-block mt-4 text-earth-400 hover:text-harvest-300 text-sm underline underline-offset-2">
                Go to Sign In
              </Link> */}
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
                <h2 className="font-display text-xl font-bold text-earth-400 mb-1">Create new password</h2>
                <p className="text-slate-400 text-sm">Choose a strong password for your account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 characters"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-11 py-3 text-slate-400 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-earth-400"
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-400" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      required
                      value={form.confirm}
                      onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                      placeholder="Repeat your password"
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-11 py-3 text-slate-400 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-harvest-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(s => !s)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-earth-400 hover:text-earth-200"
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
                  className="w-full bg-earth-500 hover:bg-harvest-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-harvest-500/30"
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
                className="flex items-center justify-center gap-2 text-earth-500 hover:text-harvest-200 text-sm font-medium transition-colors"
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