"use client";

import React from "react";
import { DashboardShell, NavItem } from "@/components/DashboardShell";
import { ShoppingBag, ClipboardText, ShieldCheck, BookOpenText } from "@phosphor-icons/react";
import { AuthGate } from "@/components/AuthGate";

const navItems: NavItem[] = [
  { label: "Marketplace", href: "/marketplace", icon: ShoppingBag },
  { label: "My Orders", href: "/dashboard/buyer/orders", icon: ClipboardText },
  { label: "Compliance", href: "/dashboard/buyer/compliance", icon: ShieldCheck },
  { label: "Ledger", href: "/ledger", icon: BookOpenText },
];

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate allowRoles={["BUYER", "ADMIN"]}>
      <DashboardShell
        title="Buyer Console"
        subtitle="Source verified crops and monitor blockchain-backed orders."
        role="Buyer"
        navItems={navItems}
      >
        {children}
      </DashboardShell>
    </AuthGate>
  );
}
