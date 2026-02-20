"use client";

import { useState } from "react";
import { api, setToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Router, Mail, ArrowRight, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/magic-link", { email });
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(#00d4aa 1px, transparent 1px), linear-gradient(90deg, #00d4aa 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12 justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <Router size={20} className="text-background" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-text leading-none">
              MikroTik
            </h1>
            <p className="font-mono text-xs text-accent leading-none mt-0.5">
              MANAGER
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8">
          {!sent ? (
            <>
              <h2 className="font-display text-xl font-bold text-text mb-2">
                Sign in
              </h2>
              <p className="text-text-dim text-sm font-mono mb-8">
                We'll send a magic link to your email
              </p>

              <form onSubmit={requestLink} className="space-y-4">
                <div>
                  <label className="font-mono text-xs text-text-dim uppercase tracking-widest mb-2 block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-3 font-mono text-sm text-text placeholder:text-text-dim/50 focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-danger text-xs font-mono">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-background font-display font-bold rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="animate-pulse font-mono text-sm">Sending...</span>
                  ) : (
                    <>
                      Send Magic Link
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <CheckCircle size={40} className="text-accent mx-auto mb-4" />
              <h2 className="font-display text-xl font-bold text-text mb-2">
                Check your inbox
              </h2>
              <p className="text-text-dim text-sm font-mono">
                We sent a login link to
                <br />
                <span className="text-accent">{email}</span>
              </p>
              <p className="text-text-dim text-xs font-mono mt-4 opacity-60">
                Link expires in 15 minutes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
