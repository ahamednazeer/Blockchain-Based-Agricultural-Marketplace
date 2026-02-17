"use client";

import React, { useState } from "react";
import Link from "next/link";
import { User, Phone, MapPin, Wallet, ShieldCheck } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { connectWallet } from "@/lib/wallet";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    contact: "",
    location: "",
    role: "FARMER",
    walletAddress: "",
  });
  const [status, setStatus] = useState<null | "success" | "error">(null);
  const [message, setMessage] = useState("");

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleConnect = async () => {
    try {
      const wallet = await connectWallet();
      updateField("walletAddress", wallet);
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "MetaMask connection failed");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setMessage("");

    try {
      await api.registerUser({
        name: form.name,
        contact: form.contact,
        location: form.location,
        role: form.role as "FARMER" | "BUYER",
        walletAddress: form.walletAddress,
      });
      setStatus("success");
      setMessage("Registration submitted.");
      setForm((prev) => ({ ...prev, name: "", contact: "", location: "" }));
      router.push("/register/submitted");
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--color-background)] text-slate-100 relative">
      <div className="scanlines" />
      <div className="absolute inset-0 grid-glow" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between">
          <div>
            <p className="hud-label">AgriChain Registration</p>
            <h1 className="text-3xl font-bold mt-2">Request Marketplace Access</h1>
            <p className="text-slate-400 mt-2">
              Farmers and buyers must be approved by the admin before they can list or purchase crops.
            </p>
          </div>
          <Link href="/" className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200">
            Back to Login
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <form className="hud-panel p-8 space-y-6" onSubmit={handleSubmit}>
            <div className="hud-card border border-amber-400/50 bg-amber-500/10 text-amber-100">
              <p className="text-sm font-semibold">Approval Required</p>
              <p className="text-xs text-amber-200/80 mt-2">
                Registrations are reviewed by the admin before access is activated.
              </p>
            </div>
            {status && (
              <div
                className={`rounded-sm border px-4 py-3 text-sm ${
                  status === "success"
                    ? "border-emerald-500/40 text-green-400 bg-green-950/50"
                    : "border-rose-500/40 text-rose-200 bg-rose-500/10"
                }`}
              >
                {message}
              </div>
            )}
            <div>
              <label className="hud-label">Full Name</label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-sm pl-10 pr-4 py-3 text-sm text-slate-100 focus:border-green-600 outline-none"
                  placeholder="Enter your name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="hud-label">Contact</label>
              <div className="relative mt-2">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-sm pl-10 pr-4 py-3 text-sm text-slate-100 focus:border-green-600 outline-none"
                  placeholder="+91 90000 00000"
                  value={form.contact}
                  onChange={(e) => updateField("contact", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="hud-label">Location</label>
              <div className="relative mt-2">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-sm pl-10 pr-4 py-3 text-sm text-slate-100 focus:border-green-600 outline-none"
                  placeholder="City / Region"
                  value={form.location}
                  onChange={(e) => updateField("location", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="hud-label">Role</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateField("role", "FARMER")}
                  className={`border rounded-sm px-4 py-3 text-left hover:border-green-600 ${
                    form.role === "FARMER" ? "border-green-600 bg-green-950/50" : "border-slate-700"
                  }`}
                >
                  <p className="text-sm font-semibold">Farmer</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">List crops</p>
                </button>
                <button
                  type="button"
                  onClick={() => updateField("role", "BUYER")}
                  className={`border rounded-sm px-4 py-3 text-left hover:border-blue-600 ${
                    form.role === "BUYER" ? "border-blue-600 bg-blue-950/50" : "border-slate-700"
                  }`}
                >
                  <p className="text-sm font-semibold">Buyer</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Purchase crops</p>
                </button>
              </div>
            </div>
            <div>
              <label className="hud-label">Wallet Address</label>
              <div className="relative mt-2">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-sm pl-10 pr-4 py-3 text-sm text-slate-100 focus:border-green-600 outline-none"
                  placeholder="0x0000..."
                  value={form.walletAddress}
                  onChange={(e) => updateField("walletAddress", e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={handleConnect}
                className="mt-3 text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-green-400"
              >
                Connect MetaMask
              </button>
            </div>
            <button className="w-full bg-green-950/50 border border-green-600 text-green-400 rounded-sm py-3 text-sm font-mono uppercase tracking-[0.2em] hover:bg-green-900/60">
              Submit for Approval
            </button>
          </form>

          <aside className="space-y-6">
            <div className="hud-card">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-sm bg-slate-900 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-blue-300" weight="duotone" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Admin Validation</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">KYC + Wallet Verification</p>
                </div>
              </div>
            </div>
            <div className="hud-card space-y-3">
              <p className="hud-label">Approval Timeline</p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li>Registration stored off-chain in MongoDB.</li>
                <li>Admin reviews identity, role, and wallet address.</li>
                <li>Once approved, access is activated on the dashboard.</li>
              </ul>
            </div>
            <div className="hud-card">
              <p className="hud-label">Need Help?</p>
              <p className="text-sm text-slate-300 mt-2">
                Contact the admin team or use the in-app support chat after registration.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
