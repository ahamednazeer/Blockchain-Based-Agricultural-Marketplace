"use client";

import React from "react";
import { DashboardShell, NavItem } from "@/components/DashboardShell";
import {
  Gauge,
  Users,
  ClipboardText,
  BookOpenText,
  ChartLineUp,
  ShieldCheck,
  Database,
} from "@phosphor-icons/react";
import { AuthGate } from "@/components/AuthGate";
import { usePathname } from "next/navigation";

const navItems: NavItem[] = [
  { label: "Overview", href: "/admin", icon: Gauge },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Listings", href: "/admin/listings", icon: ClipboardText },
  { label: "Transactions", href: "/admin/transactions", icon: BookOpenText },
  { label: "Waste Data", href: "/admin/waste-data", icon: Database },
  { label: "Reports", href: "/admin/reports", icon: ChartLineUp },
  { label: "Emergency", href: "/admin/emergency", icon: ShieldCheck },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <AuthGate allowRoles={["ADMIN"]} redirectTo="/admin/login">
      <DashboardShell
        title="Admin Control Center"
        subtitle="Approve users, validate listings, and monitor blockchain activity."
        role="Admin"
        navItems={navItems}
      >
        {children}
      </DashboardShell>
    </AuthGate>
  );
}
