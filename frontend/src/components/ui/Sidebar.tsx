"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Terminal,
  Bell,
  Settings,
  Router,
  Activity,
  LogOut,
} from "lucide-react";
import clsx from "clsx";
import { clearToken } from "@/lib/api";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/", icon: LayoutGrid, label: "Fleet" },
  { href: "/scripts", icon: Terminal, label: "Scripts" },
  { href: "/alerts", icon: Bell, label: "Alerts" },
  { href: "/metrics", icon: Activity, label: "Metrics" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearToken();
    router.push("/auth/login");
  };

  return (
    <aside className="w-16 bg-surface border-r border-border flex flex-col items-center py-6 shrink-0">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Router size={16} className="text-background" />
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={clsx(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative",
                active
                  ? "bg-accent/20 text-accent"
                  : "text-text-dim hover:text-text hover:bg-border"
              )}
            >
              <Icon size={18} />
              {active && (
                <div className="absolute left-0 w-0.5 h-5 bg-accent rounded-r-full -translate-x-3" />
              )}
              {/* Tooltip */}
              <div className="absolute left-14 bg-surface border border-border text-text text-xs font-mono px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity z-50">
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={logout}
        title="Logout"
        className="w-10 h-10 rounded-lg flex items-center justify-center text-text-dim hover:text-danger hover:bg-danger/10 transition-all"
      >
        <LogOut size={18} />
      </button>
    </aside>
  );
}
