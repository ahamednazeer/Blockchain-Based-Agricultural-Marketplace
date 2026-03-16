"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Cube, ShieldCheck, Leaf, Storefront, Wallet, Bell, CaretDoubleLeft, CaretDoubleRight } from "@phosphor-icons/react";
import { StatusBadge } from "./StatusBadge";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  tag?: string;
}

interface DashboardShellProps {
  title: string;
  subtitle: string;
  role: "Admin" | "Farmer" | "Buyer";
  navItems: NavItem[];
  children: React.ReactNode;
}

const roleIconMap = {
  Admin: ShieldCheck,
  Farmer: Leaf,
  Buyer: Storefront,
};

export function DashboardShell({ title, subtitle, role, navItems, children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const RoleIcon = roleIconMap[role];
  const [wallet, setWallet] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const resizeRef = useRef({
    active: false,
    startX: 0,
    startWidth: 260,
  });
  const widthRef = useRef(260);

  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  useEffect(() => {
    const storedWallet = typeof window !== "undefined" ? localStorage.getItem("auth_wallet") : null;
    if (storedWallet) {
      const normalized = storedWallet.toLowerCase();
      const stripped = normalized.startsWith("0x") ? normalized.slice(2) : normalized;
      const isZero = stripped.length > 0 && /^0+$/.test(stripped);
      setWallet(isZero ? null : storedWallet);
    } else {
      setWallet(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const storedWidth = Number(localStorage.getItem("sidebar_width"));
    if (Number.isFinite(storedWidth) && storedWidth >= 220 && storedWidth <= 380) {
      setSidebarWidth(storedWidth);
      resizeRef.current.startWidth = storedWidth;
      widthRef.current = storedWidth;
    }
    const collapsed = localStorage.getItem("sidebar_collapsed");
    if (collapsed === "true") {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMove = (clientX: number) => {
      if (!resizeRef.current.active) return;
      const delta = clientX - resizeRef.current.startX;
      const next = Math.min(380, Math.max(220, resizeRef.current.startWidth + delta));
      setSidebarWidth(next);
    };

    const handlePointerMove = (event: PointerEvent) => handleMove(event.clientX);
    const handleMouseMove = (event: MouseEvent) => handleMove(event.clientX);
    const handleTouchMove = (event: TouchEvent) => {
      if (!event.touches[0]) return;
      handleMove(event.touches[0].clientX);
    };

    const handlePointerUp = () => {
      if (!resizeRef.current.active) return;
      resizeRef.current.active = false;
      document.body.style.userSelect = "";
      localStorage.setItem("sidebar_width", String(widthRef.current));
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handlePointerUp);
    window.addEventListener("touchcancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("touchcancel", handlePointerUp);
    };
  }, []);

  const beginResize = (clientX: number, capture?: () => void) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_collapsed", "false");
      }
    }
    const baseWidth = Math.max(220, widthRef.current);
    setSidebarWidth(baseWidth);
    widthRef.current = baseWidth;
    resizeRef.current.active = true;
    resizeRef.current.startX = clientX;
    resizeRef.current.startWidth = baseWidth;
    document.body.style.userSelect = "none";
    if (capture) {
      capture();
    }
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    beginResize(event.clientX, () => event.currentTarget.setPointerCapture(event.pointerId));
  };

  const startResizeMouse = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    beginResize(event.clientX);
  };

  const startResizeTouch = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();
    beginResize(touch.clientX);
  };

  const EDGE_GRAB = 10;
  const tryStartResizeFromEdge = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const withinEdge = clientX >= rect.right - EDGE_GRAB && clientX <= rect.right + EDGE_GRAB;
    if (!withinEdge) return false;
    beginResize(clientX);
    return true;
  };

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_collapsed", next ? "true" : "false");
      }
      return next;
    });
  };


  const walletLabel = useMemo(() => {
    if (!wallet) {
      return role === "Admin" ? "Server managed" : "Not connected";
    }
    if (wallet.length <= 12) {
      return wallet;
    }
    return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  }, [wallet, role]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_role");
      localStorage.removeItem("auth_wallet");
      localStorage.removeItem("auth_name");
    }
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <div className="scanlines" />
      <div className="flex min-h-screen w-full">
        <aside
          className="relative border-r border-slate-800 bg-slate-900 px-3 py-4 h-screen sticky top-0"
          style={{ width: isCollapsed ? 88 : sidebarWidth, minWidth: isCollapsed ? 88 : 220, maxWidth: 380 }}
          onPointerDown={(event) => {
            if (tryStartResizeFromEdge(event.clientX, event.currentTarget)) {
              event.preventDefault();
            }
          }}
          onMouseDown={(event) => {
            if (tryStartResizeFromEdge(event.clientX, event.currentTarget)) {
              event.preventDefault();
            }
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (touch && tryStartResizeFromEdge(touch.clientX, event.currentTarget)) {
              event.preventDefault();
            }
          }}
        >
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Cube size={22} weight="duotone" className="text-blue-400" />
              </div>
              {!isCollapsed && (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] font-mono text-slate-500">AgriChain</p>
                  <p className="text-sm font-bold">Marketplace Grid</p>
                </div>
              )}
            </div>
            <button
              onClick={toggleCollapse}
              className="h-8 w-8 rounded-sm border border-slate-700 flex items-center justify-center text-slate-300 hover:border-slate-500"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
            >
              {isCollapsed ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {!isCollapsed ? (
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm p-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-sm bg-slate-900 border border-slate-700 flex items-center justify-center">
                    <RoleIcon size={18} className="text-blue-400" weight="duotone" />
                  </div>
                  <div>
                    <p className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">Role</p>
                    <p className="text-sm font-semibold">{role} Console</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="h-9 w-9 rounded-sm bg-slate-900 border border-slate-700 flex items-center justify-center">
                  <RoleIcon size={18} className="text-blue-400" weight="duotone" />
                </div>
              </div>
            )}

            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "text-blue-400 bg-blue-950/50 border-l-2 border-blue-400"
                        : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={18} weight="duotone" />
                      {!isCollapsed && item.label}
                    </span>
                    {item.tag && (
                      <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-slate-500">
                        {item.tag}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            onPointerDown={startResize}
            onMouseDown={startResizeMouse}
            onTouchStart={startResizeTouch}
            className="absolute right-0 top-0 h-full w-3 cursor-col-resize hover:bg-blue-500/50 transition z-20"
            style={{ touchAction: "none" }}
            title="Drag to resize"
          />
        </aside>

        <main className="flex-1">
          <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 backdrop-blur-md bg-slate-950/80 px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wider">{title}</h1>
              <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm px-4 py-2 flex items-center gap-2">
                <Wallet size={18} className="text-blue-400" weight="duotone" />
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">Wallet</span>
                <span className="text-sm font-semibold">{walletLabel}</span>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-sm px-4 py-2 flex items-center gap-2">
                <Bell size={18} className="text-blue-400" weight="duotone" />
                <StatusBadge label="LIVE" tone="active" />
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-slate-700 rounded-sm hover:border-red-500 text-red-300"
              >
                Logout
              </button>
            </div>
          </header>

          <div className="p-6 space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
