"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Wallet, Leaf, Storefront, Circuitry } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { connectWallet, signMessage } from "@/lib/wallet";

export default function HomePage() {
  const router = useRouter();
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState<null | "loading" | "error">(null);
  const [message, setMessage] = useState("");
  const [metamaskStatus, setMetamaskStatus] = useState<"connected" | "disconnected" | "missing">("disconnected");
  const [notApproved, setNotApproved] = useState(false);

  useEffect(() => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setMetamaskStatus("missing");
      return;
    }

    const checkAccounts = async () => {
      try {
        const accounts = await ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          setWallet(accounts[0]);
          setMetamaskStatus("connected");
        } else {
          setWallet("");
          setMetamaskStatus("disconnected");
        }
      } catch {
        setMetamaskStatus("disconnected");
      }
    };

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setWallet(accounts[0]);
        setMetamaskStatus("connected");
      } else {
        setWallet("");
        setMetamaskStatus("disconnected");
      }
    };

    checkAccounts();
    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  const handleLogin = async () => {
    try {
      setStatus("loading");
      setMessage("");
      setNotApproved(false);
      const connected = await connectWallet();
      setWallet(connected);
      setMetamaskStatus("connected");
      const nonceResponse = await api.getNonce(connected);
      const signature = await signMessage(nonceResponse.message, connected);
      const auth = await api.verifySignature(connected, signature);
      localStorage.setItem("auth_token", auth.token);
      localStorage.setItem("auth_role", auth.role);
      if (auth.wallet) {
        localStorage.setItem("auth_wallet", auth.wallet);
      }
      if (auth.name) {
        localStorage.setItem("auth_name", auth.name);
      }
      if (auth.role === "ADMIN") {
        router.push("/admin");
      } else if (auth.role === "FARMER") {
        router.push("/dashboard/farmer");
      } else {
        router.push("/dashboard/buyer");
      }
      setStatus(null);
    } catch (error: any) {
      setStatus("error");
      const errorMessage = error.message || "Wallet authentication failed";
      setMessage(errorMessage);
      setNotApproved(errorMessage.toLowerCase().includes("not approved"));
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] text-slate-100 relative overflow-hidden">
      <div className="scanlines" />
      <div className="absolute inset-0 grid-glow" />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/40 to-sky-500/30 flex items-center justify-center">
              <Circuitry size={26} weight="duotone" className="text-emerald-200" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-slate-400">AgriChain</p>
              <p className="text-lg font-bold">Blockchain Marketplace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/register"
              className="px-4 py-2 text-xs font-mono uppercase tracking-[0.3em] border border-slate-700/80 rounded-full hover:border-emerald-400/60"
            >
              Register
            </Link>
          </div>
        </header>

        <section className="mt-16 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs font-mono uppercase tracking-[0.2em]">
              <ShieldCheck size={16} weight="duotone" />
              Admin-Governed Marketplace
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Verified crops. Transparent trades. <span className="text-gradient">On-chain trust.</span>
            </h1>
            <p className="text-slate-300 text-lg">
              AgriChain synchronizes farmer listings, admin approvals, and buyer purchases with Ganache-powered smart contracts.
              Every crop, every transaction, every ledger entry is immutable and auditable.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleLogin}
                disabled={status === "loading"}
                className="hud-panel px-6 py-3 text-sm font-mono uppercase tracking-[0.2em] text-emerald-200 border border-emerald-400/40 hover:border-emerald-300/70 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  <Wallet size={18} weight="duotone" />
                  {status === "loading" ? "Connecting..." : "Connect MetaMask (Farmer/Buyer)"}
                </span>
              </button>
            </div>
            {wallet && (
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                Wallet connected: {wallet}
              </p>
            )}
            {status === "error" && (
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-rose-300">
                {message}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="hud-card">
                <p className="hud-label mb-2">Governance</p>
                <p className="text-sm text-slate-300">Admin approvals for users, listings, and emergency pause control.</p>
              </div>
              <div className="hud-card">
                <p className="hud-label mb-2">Listings</p>
                <p className="text-sm text-slate-300">Dual storage: metadata in MongoDB, price + ownership on-chain.</p>
              </div>
              <div className="hud-card">
                <p className="hud-label mb-2">Ledger</p>
                <p className="text-sm text-slate-300">Immutable CropListed + CropPurchased events, verified in seconds.</p>
              </div>
            </div>
          </div>

          <div className="hud-panel p-6 space-y-5 animate-slide-up">
            <div>
              <p className="hud-label">Secure Login</p>
              <h2 className="text-2xl font-bold mt-2">Role-Based Access</h2>
              <p className="text-slate-400 mt-2 text-sm">
                Farmers and buyers sign in with MetaMask. Admins use secure credentials to validate every account before trading begins.
              </p>
            </div>
            {notApproved && (
              <div className="hud-card border border-amber-400/50 bg-amber-500/10 text-amber-100">
                <p className="text-sm font-semibold">Approval Pending</p>
                <p className="text-xs text-amber-200/80 mt-2">
                  Your wallet is registered but not yet approved by the admin. Please wait for activation, then sign in again.
                </p>
              </div>
            )}
            <div className="space-y-4">
              <button
                onClick={() => router.push("/admin/login")}
                className="w-full border border-slate-700/70 rounded-lg px-4 py-3 text-left hover:border-sky-400/60"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={18} className="text-violet-300" weight="duotone" />
                  <div>
                    <p className="text-sm font-semibold">Admin</p>
                    <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Username + password</p>
                  </div>
                </div>
              </button>
              <button
                onClick={handleLogin}
                disabled={status === "loading"}
                className="w-full border border-slate-700/70 rounded-lg px-4 py-3 text-left hover:border-emerald-400/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <Leaf size={18} className="text-emerald-300" weight="duotone" />
                  <div>
                    <p className="text-sm font-semibold">Farmer</p>
                    <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">List crops + manage inventory</p>
                  </div>
                </div>
              </button>
              <button
                onClick={handleLogin}
                disabled={status === "loading"}
                className="w-full border border-slate-700/70 rounded-lg px-4 py-3 text-left hover:border-sky-400/60 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <Storefront size={18} className="text-sky-300" weight="duotone" />
                  <div>
                    <p className="text-sm font-semibold">Buyer</p>
                    <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Purchase verified crops</p>
                  </div>
                </div>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
              <span>Ganache Ready</span>
              <span>
                {metamaskStatus === "connected"
                  ? "MetaMask Connected"
                  : metamaskStatus === "missing"
                    ? "MetaMask Not Found"
                    : "MetaMask Disconnected"}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
