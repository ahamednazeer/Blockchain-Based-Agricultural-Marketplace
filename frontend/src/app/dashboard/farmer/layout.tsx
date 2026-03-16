"use client";

import React from "react";
import { DashboardShell, NavItem } from "@/components/DashboardShell";
import { Gauge, ClipboardText, PlusCircle, Basket, Timer, Toolbox, Robot } from "@phosphor-icons/react";
import { AuthGate } from "@/components/AuthGate";

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard/farmer", icon: Gauge },
  { label: "My Listings", href: "/dashboard/farmer/listings", icon: ClipboardText },
  { label: "New Listing", href: "/dashboard/farmer/new", icon: PlusCircle },
  { label: "Orders", href: "/dashboard/farmer/orders", icon: Basket },
  { label: "Expiry Watch", href: "/dashboard/farmer/expiry", icon: Timer },
  { label: "Resources", href: "/dashboard/farmer/resources", icon: Toolbox },
  { label: "AI Advisor", href: "/dashboard/farmer/intelligence", icon: Robot, tag: "AI" },
];

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate allowRoles={["FARMER"]}>
      <DashboardShell
        title="Farmer Command"
        subtitle="Manage crop listings, approvals, and inventory health."
        role="Farmer"
        navItems={navItems}
      >
        {children}
      </DashboardShell>
    </AuthGate>
  );
}
