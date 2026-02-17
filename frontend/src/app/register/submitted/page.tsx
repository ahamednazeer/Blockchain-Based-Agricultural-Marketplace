"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Clock } from "@phosphor-icons/react";

export default function RegistrationSubmitted() {
  return (
    <div className="min-h-screen bg-[color:var(--color-background)] text-slate-100 relative">
      <div className="scanlines" />
      <div className="absolute inset-0 grid-glow" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
        <div className="hud-panel p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-sm bg-green-950/50 flex items-center justify-center">
              <ShieldCheck size={22} className="text-green-400" weight="duotone" />
            </div>
            <div>
              <p className="hud-label">Submission Complete</p>
              <h1 className="text-3xl font-bold mt-1">Registration Submitted</h1>
            </div>
          </div>

          <div className="hud-card text-slate-200 border border-green-600">
            <p className="text-base">Await admin approval to access your dashboard.</p>
            <p className="text-sm text-slate-400 mt-2">
              The admin team verifies your identity and wallet address before activating access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="hud-card">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-amber-300" weight="duotone" />
                <div>
                  <p className="text-sm font-semibold">Review Timeline</p>
                  <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">24–48 hours</p>
                </div>
              </div>
            </div>
            <div className="hud-card">
              <p className="text-sm font-semibold">Next Step</p>
              <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em] mt-2">Login with MetaMask after approval</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/"
              className="px-5 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-slate-700/70 rounded-sm hover:border-green-600"
            >
              Back to Login
            </Link>
            <Link
              href="/register"
              className="px-5 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-blue-600 rounded-sm text-blue-400 hover:bg-blue-950/50"
            >
              Register Another User
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
