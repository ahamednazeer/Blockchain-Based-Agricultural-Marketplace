"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AuthGateProps {
  allowRoles?: string[];
  redirectTo?: string;
  children: React.ReactNode;
}

export function AuthGate({ allowRoles, redirectTo = "/", children }: AuthGateProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const role = localStorage.getItem("auth_role");

    if (!token) {
      router.replace(redirectTo);
      return;
    }

    if (allowRoles && (!role || !allowRoles.includes(role))) {
      router.replace(redirectTo);
      return;
    }

    setAllowed(true);
  }, [allowRoles, redirectTo, router]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[color:var(--color-background)] text-slate-400">
        <div className="hud-card text-sm">Redirecting…</div>
      </div>
    );
  }

  return <>{children}</>;
}
