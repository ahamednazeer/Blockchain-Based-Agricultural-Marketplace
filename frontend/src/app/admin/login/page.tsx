"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, User } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { connectWallet, signMessage } from "@/lib/wallet";
import { getReadableWalletError } from "@/lib/walletErrors";

export default function AdminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [status, setStatus] = useState<null | "loading" | "error">(null);
  const [message, setMessage] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);

  const updateField = (key: "username" | "password", value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const auth = await api.adminLogin({
        username: form.username.trim(),
        password: form.password,
      });
      localStorage.setItem("auth_token", auth.token);
      localStorage.setItem("auth_role", auth.role);
      if (auth.wallet) {
        localStorage.setItem("auth_wallet", auth.wallet);
      }
      if (auth.name) {
        localStorage.setItem("auth_name", auth.name);
      }
      setStatus(null);
      router.push("/admin");
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "Admin login failed");
    }
  };

  const handleWalletLogin = async () => {
    setWalletLoading(true);
    setStatus(null);
    setMessage("");
    try {
      const wallet = await connectWallet();
      const nonce = await api.getNonce(wallet);
      const signature = await signMessage(nonce.message, wallet);
      const auth = await api.verifySignature(wallet, signature);

      if (auth.role !== "ADMIN") {
        throw new Error("Connected wallet is not an admin account.");
      }

      localStorage.setItem("auth_token", auth.token);
      localStorage.setItem("auth_role", auth.role);
      if (auth.wallet) {
        localStorage.setItem("auth_wallet", auth.wallet);
      }
      if (auth.name) {
        localStorage.setItem("auth_name", auth.name);
      }
      router.push("/admin");
    } catch (error: any) {
      setStatus("error");
      const normalized = String(error?.message || "").toLowerCase();
      if (normalized.includes("user not found")) {
        setMessage(
          "Wallet is not registered as admin. Use the contract owner wallet or set ADMIN_WALLET to this wallet and restart backend."
        );
      } else {
        setMessage(getReadableWalletError(error, "Admin MetaMask login failed"));
      }
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] text-slate-100 relative">
      <div className="scanlines" />
      <div className="absolute inset-0 grid-glow" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <div className="flex items-center justify-between">
          <div>
            <p className="hud-label">Admin Access</p>
            <h1 className="text-3xl font-bold mt-2">Control Center Login</h1>
            <p className="text-slate-400 mt-2">
              Admins can authenticate with credentials or connect their admin MetaMask wallet.
            </p>
          </div>
          <Link href="/" className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200">
            Back to Login
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <form className="hud-panel p-8 space-y-6" onSubmit={handleSubmit}>
            <div className="hud-card border border-amber-400/50 bg-amber-500/10 text-amber-100">
              <p className="text-sm font-semibold">Approval Gate</p>
              <p className="text-xs text-amber-200/80 mt-2">
                Farmer and buyer accounts remain pending until the admin approves them.
              </p>
            </div>
            {status === "error" && (
              <div className="rounded-sm border px-4 py-3 text-sm border-rose-500/40 text-rose-200 bg-rose-500/10">
                {message}
              </div>
            )}
            <button
              type="button"
              onClick={handleWalletLogin}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-4 py-3 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={walletLoading || status === "loading"}
            >
              {walletLoading ? "Connecting Wallet..." : "Admin MetaMask Login"}
            </button>
            <details className="rounded-sm border border-slate-700/70 p-4 bg-slate-900/30">
              <summary className="cursor-pointer text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                Use Username/Password Instead
              </summary>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="hud-label">Username</label>
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                      className="w-full bg-slate-950 border border-slate-700 rounded-sm pl-10 pr-4 py-3 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="Enter admin username"
                      value={form.username}
                      onChange={(e) => updateField("username", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="hud-label">Password</label>
                  <div className="relative mt-2">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                      type="password"
                      className="w-full bg-slate-950 border border-slate-700 rounded-sm pl-10 pr-4 py-3 text-sm text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder="Enter admin password"
                      value={form.password}
                      onChange={(e) => updateField("password", e.target.value)}
                    />
                  </div>
                </div>
                <button
                  className="w-full border border-blue-500 text-blue-300 hover:bg-blue-950/50 rounded-sm font-medium tracking-wide uppercase text-sm px-4 py-3 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={status === "loading" || walletLoading}
                >
                  {status === "loading" ? "Signing in..." : "Enter Admin Console"}
                </button>
              </div>
            </details>
          </form>

          <aside className="space-y-6">
            <div className="hud-card">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-sm bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-blue-300" weight="duotone" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Admin Only</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Role Protected</p>
                </div>
              </div>
            </div>
            <div className="hud-card space-y-3">
              <p className="hud-label">What You Can Do</p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>Approve farmers and buyers.</li>
                <li>Validate crop listings before on-chain publish.</li>
                <li>Monitor transactions and ledger activity.</li>
              </ul>
            </div>
            <div className="hud-card">
              <p className="hud-label">Need Access?</p>
              <p className="text-sm text-slate-300 mt-2">
                Ask the system owner to approve your admin wallet and/or issue credentials.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
