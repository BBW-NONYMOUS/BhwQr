import {
  ActivityIcon,
  BarChart3Icon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MapPinnedIcon,
  ScanLineIcon,
  SettingsIcon,
  ShieldAlertIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Key of a dashboard count shown as a badge (pending approvals / corrections, offline kiosks). */
  badge?: "pending_registrations" | "pending_corrections" | "offline_stations";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Admin sidebar (docs/phase-4-web/README.md sitemap). */
export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/admin", icon: LayoutDashboardIcon }],
  },
  {
    label: "People",
    items: [
      { title: "Employees", href: "/admin/employees", icon: UsersIcon },
      { title: "Pending Approvals", href: "/admin/approvals", icon: UserCheckIcon, badge: "pending_registrations" },
    ],
  },
  {
    label: "Attendance",
    items: [
      { title: "Attendance Records", href: "/admin/attendance", icon: ClipboardListIcon },
      { title: "Correction Requests", href: "/admin/corrections", icon: ClipboardCheckIcon, badge: "pending_corrections" },
      { title: "Fallback Scan", href: "/admin/fallback-scan", icon: ScanLineIcon },
      { title: "DTR (CSC Form 48)", href: "/admin/dtr", icon: FileTextIcon },
      { title: "Reports", href: "/admin/reports", icon: BarChart3Icon },
    ],
  },
  {
    label: "Setup",
    items: [
      { title: "Schedules", href: "/admin/schedules", icon: CalendarClockIcon },
      { title: "Holidays", href: "/admin/holidays", icon: CalendarDaysIcon },
      { title: "Stations & Kiosks", href: "/admin/stations", icon: MapPinnedIcon },
      { title: "Settings", href: "/admin/settings", icon: SettingsIcon },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { title: "Device Health", href: "/admin/device-health", icon: ActivityIcon, badge: "offline_stations" },
      { title: "Error Logs", href: "/admin/error-logs", icon: ShieldAlertIcon },
      { title: "Audit Log", href: "/admin/audit-log", icon: HistoryIcon },
    ],
  },
];

export const VIEWER_NAV: NavGroup[] = [
  {
    label: "Barangay Management",
    items: [
      { title: "Dashboard", href: "/viewer", icon: LayoutDashboardIcon },
      { title: "Reports", href: "/viewer/reports", icon: BarChart3Icon },
    ],
  },
];

/** Title for a pathname, used by breadcrumbs. */
export function titleFor(pathname: string, groups: NavGroup[]): string | null {
  const items = groups.flatMap((g) => g.items).sort((a, b) => b.href.length - a.href.length);
  return items.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.title ?? null;
}

/** Navigation is chosen by key: icon components cannot cross the server → client boundary. */
export const NAVS = { admin: ADMIN_NAV, viewer: VIEWER_NAV } as const;
export type NavKey = keyof typeof NAVS;
