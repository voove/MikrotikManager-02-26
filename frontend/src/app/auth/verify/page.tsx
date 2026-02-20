"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { CheckCircle, XCircle, Loader, Router } from "lucide-react";

export default function VerifyPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setError("No token provided");
      return;
    }

    api
      .post<{ access_token: string }>("/auth/verify", { token })
      .then((data) => {
        setToken(data.access_token);
        setStatus("success");
        setTimeout(() => router.push("/"), 1500);
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message || "Link is invalid or expired");
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-surface border border-border rounded-2xl p-10 text-center max-w-sm w-full">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mx-auto mb-8">
          <Router size={20} className="text-background" />
        </div>

        {status === "loading" && (
          <>
            <Loader size={32} className="text-accent mx-auto mb-4 animate-spin" />
            <p className="font-mono text-sm text-text-dim">Verifying link...</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={32} className="text-accent mx-auto mb-4" />
            <h2 className="font-display text-lg font-bold text-text mb-2">
              Authenticated
            </h2>
            <p className="font-mono text-sm text-text-dim">
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={32} className="text-danger mx-auto mb-4" />
            <h2 className="font-display text-lg font-bold text-text mb-2">
              Link Invalid
            </h2>
            <p className="font-mono text-sm text-text-dim mb-6">{error}</p>
            <a
              href="/auth/login"
              className="font-mono text-sm text-accent hover:underline"
            >
              Request a new link →
            </a>
          </>
        )}
      </div>
    </div>
  );
}
