"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leaf, ShieldCheck, Wallet } from "@phosphor-icons/react";
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
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage: "linear-gradient(to bottom right, #0f172a, #1e293b)",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      <div className="scanlines" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-slate-900/90 border border-slate-700 rounded-sm p-8 backdrop-blur-md">
          <div className="flex flex-col items-center mb-8">
            <Leaf size={48} weight="duotone" className="text-blue-400 mb-4" />
            <h1 className="text-3xl font-chivo font-bold uppercase tracking-wider text-center">
              AgriChain Marketplace
            </h1>
            <p className="text-slate-400 text-sm mt-2">Blockchain Based Agricultural Trading Platform</p>
          </div>

          {status === "error" && (
            <div className="bg-red-950/50 border border-red-800 rounded-sm p-3 mb-4 text-sm text-red-400">
              {message}
            </div>
          )}

          {notApproved && (
            <div className="bg-yellow-950/50 border border-yellow-800 rounded-sm p-3 mb-4 text-sm text-yellow-400">
              Your wallet is registered but still pending admin approval.
            </div>
          )}

          <div className="space-y-3" data-testid="wallet-login-options">
            <button
              type="button"
              onClick={() => router.push("/admin/login")}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-4 py-3 transition-all duration-150 border border-slate-700"
            >
              <span className="inline-flex items-center gap-2">
                <ShieldCheck size={18} weight="duotone" />
                Admin Login
              </span>
            </button>

            <button
              type="button"
              onClick={handleLogin}
              disabled={status === "loading"}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-4 py-3 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center gap-2">
                <Wallet size={18} weight="duotone" />
                {status === "loading" ? "Connecting..." : "MetaMask Login (Admin / Farmer / Buyer)"}
              </span>
            </button>

            <Link
              href="/register"
              className="w-full inline-flex justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-sm font-medium tracking-wide uppercase text-sm px-4 py-3 transition-all duration-150"
            >
              Register New Account
            </Link>
          </div>

          <div className="mt-6 p-4 bg-slate-950/50 border border-slate-800 rounded-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-mono">Connection Status:</p>
            <div className="space-y-1 text-xs font-mono text-slate-400 break-all">
              <div>
                MetaMask:{" "}
                {metamaskStatus === "connected"
                  ? "Connected"
                  : metamaskStatus === "missing"
                    ? "Not Found"
                    : "Disconnected"}
              </div>
              {wallet && <div>Wallet: {wallet}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
