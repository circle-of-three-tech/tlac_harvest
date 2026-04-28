// components/layout/Sidebar.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  FileText,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Settings,
  Megaphone,
  User,
  MessageSquare,
  ActivitySquare,
  Wheat,
  BarChart3,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const evangelistNav: NavItem[] = [
  { href: "/dashboard/evangelist", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/evangelist/leads", label: "My Leads", icon: FileText },
  { href: "/dashboard/evangelist/profile", label: "Profile", icon: User },
];

const followupNav: NavItem[] = [
  { href: "/dashboard/followup", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/dashboard/followup/leads",
    label: "Assigned Leads",
    icon: FileText,
  },
  { href: "/dashboard/followup/profile", label: "Profile", icon: User },
];

const adminNav: NavItem[] = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/admin/leads", label: "All Leads", icon: FileText },
  {
    href: "/dashboard/admin/evangelists",
    label: "All Evangelists",
    icon: Users,
  },
  {
    href: "/dashboard/admin/followups",
    label: "All Follow-Up Team",
    icon: UserCheck,
  },
  {
    href: "/dashboard/admin/activity-log",
    label: "Followup Activities",
    icon: ActivitySquare,
  },
  {
    href: "/dashboard/admin/announcements",
    label: "Announcements",
    icon: Megaphone,
  },
  {
    href: "/dashboard/admin/sms-settings",
    label: "SMS Settings",
    icon: Settings,
  },
  {
    href: "/dashboard/admin/sms-logs",
    label: "SMS Logs",
    icon: MessageSquare,
  },
  {
    href: "/dashboard/admin/reports",
    label: "Monthly Reports",
    icon: BarChart3,
  },
];

const ROLE_NAV: Record<string, NavItem[]> = {
  ADMIN: adminNav,
  EVANGELIST: evangelistNav,
  FOLLOWUP: followupNav,
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-harvest-100 text-harvest-700",
  EVANGELIST: "bg-harvest-100 text-harvest-700",
  FOLLOWUP: "bg-harvest-100 text-harvest-700",
};

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role ?? "EVANGELIST";
  const navItems = ROLE_NAV[role] ?? evangelistNav;

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex justify-between h-full flex-col items-center">
      <div className="w-full">
        <div className="flex justify-between mt-4 items-center">
         
            <span className="flex gap-2 py-5 w-fit ml-7 items-center justify-center">
              <Wheat className="w-4 h-4 text-earth-500 mx-auto mb-2" />
              <h1 className="text-lg w-fit font-bold text-transparent bg-clip-text bg-gradient-to-r from-earth-300 to-earth-600">
                TLAC Harvest
              </h1>
            </span>
          {/* </div> */}

          {/* Close Btn */}
          <div className="px-4 md:hidden">
            <button
              onClick={() => handleNavClick()}
              className="bg-white text-earth-500  p-2 rounded-xl"
            >
              <X className="" />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard/admin" &&
                item.href !== "/dashboard/evangelist" &&
                item.href !== "/dashboard/followup" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "sidebar-link",
                  active ? "sidebar-link-active" : "sidebar-link-inactive",
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="sm:text-left sm:inline">{item.label}</span>
                {active && (
                  <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70 hidden sm:block" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User */}
      <div className="w-full p-4">
        {/* <div> */}

        {/* 1 */}
        <div className="flex items-center gap-3 px-3 py-1 rounded-xl group">
          <div className="w-8 h-8 rounded-full bg-harvest-200 flex items-center justify-center text-harvest-700 font-bold text-sm flex-shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0 sm:block">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {session?.user?.name}
            </p>
            {/* <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="p-1.5 rounded-lg text-earth-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Sign out"
            > */}
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded-md",
                ROLE_COLORS[role],
              )}
            >
              {role.charAt(0) + role.slice(1).toLowerCase().replace("_", "-")}
            </span>
            {/* </button> */}
          </div>
        </div>

        {/* </div> */}
        {/* 2 */}
        <div className="w-full flex items-center gap-3 px-3 py-2 rounded-xl ">
          <div className="flex-1 min-w-0 mt-2 sm:block">
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="flex gap-2 items-center text-sm rounded-lg text-slate-600 hover:bg-harvest-100 transition-all px-3 py-2"
              title="Sign out"
            >
              <LogOut className="w-4 h-4 text-slate-600" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-harvest-400 rounded-xl hover:bg-earth-400 text-white"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "lg:hidden fixed top-0 left-0 z-40 w-64 h-screen bg-white flex flex-col transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-[90%]">{sidebarContent}</div>
      </aside>
    </>
  );
}
