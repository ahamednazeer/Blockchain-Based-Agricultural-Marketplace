"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DashboardShell, NavItem } from "@/components/DashboardShell";
import {
  Gauge,
  Users,
  ClipboardText,
  BookOpenText,
  ChartLineUp,
  ShieldCheck,
  PlusCircle,
  Basket,
  Timer,
  ShoppingBag,
} from "@phosphor-icons/react";
import { AuthGate } from "@/components/AuthGate";

type ShellRole = "Admin" | "Farmer" | "Buyer";
type AuthRole = "ADMIN" | "FARMER" | "BUYER";

const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", icon: Gauge },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Listings", href: "/admin/listings", icon: ClipboardText },
  { label: "Transactions", href: "/admin/transactions", icon: BookOpenText },
  { label: "Reports", href: "/admin/reports", icon: ChartLineUp },
  { label: "Emergency", href: "/admin/emergency", icon: ShieldCheck },
  { label: "Ledger", href: "/ledger", icon: BookOpenText },
];

const farmerNav: NavItem[] = [
  { label: "Overview", href: "/dashboard/farmer", icon: Gauge },
  { label: "My Listings", href: "/dashboard/farmer/listings", icon: ClipboardText },
  { label: "New Listing", href: "/dashboard/farmer/new", icon: PlusCircle },
  { label: "Orders", href: "/dashboard/farmer/orders", icon: Basket },
  { label: "Expiry Watch", href: "/dashboard/farmer/expiry", icon: Timer },
  { label: "Ledger", href: "/ledger", icon: BookOpenText },
];

const buyerNav: NavItem[] = [
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { label: "My Orders", href: "/dashboard/buyer/orders", icon: ClipboardText },
  { label: "Compliance", href: "/dashboard/buyer/compliance", icon: ShieldCheck },
  { label: "Ledger", href: "/ledger", icon: BookOpenText },
];

export default function LedgerLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AuthRole>("BUYER");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedRole = (localStorage.getItem("auth_role") || "").toUpperCase();
    if (storedRole === "ADMIN" || storedRole === "FARMER" || storedRole === "BUYER") {
      setRole(storedRole);
    }
  }, []);

  const shellConfig = useMemo(() => {
    if (role === "ADMIN") {
      return {
        role: "Admin" as ShellRole,
        title: "Admin Control Center",
        subtitle: "Approve users, validate listings, and monitor blockchain activity.",
        navItems: adminNav,
      };
    }
    if (role === "FARMER") {
      return {
        role: "Farmer" as ShellRole,
        title: "Farmer Command",
        subtitle: "Manage crop listings, approvals, and inventory health.",
        navItems: farmerNav,
      };
    }
    return {
      role: "Buyer" as ShellRole,
      title: "Buyer Console",
      subtitle: "Source verified crops and monitor blockchain-backed orders.",
      navItems: buyerNav,
    };
  }, [role]);

  return (
    <AuthGate allowRoles={["ADMIN", "FARMER", "BUYER"]}>
      <DashboardShell
        title={shellConfig.title}
        subtitle={shellConfig.subtitle}
        role={shellConfig.role}
        navItems={shellConfig.navItems}
      >
        {children}
      </DashboardShell>
    </AuthGate>
  );
}
