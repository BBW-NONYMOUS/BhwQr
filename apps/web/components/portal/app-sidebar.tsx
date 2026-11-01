"use client";

import { HeartPulseIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NAVS, type NavKey } from "./nav-config";
import { NavUser, type NavUserProps } from "./nav-user";

export type NavCounts = Partial<Record<"pending_registrations" | "pending_corrections" | "offline_stations", number>>;

export function AppSidebar({
  nav,
  user,
  counts = {},
  ...props
}: ComponentProps<typeof Sidebar> & { nav: NavKey; user: NavUserProps["user"]; counts?: NavCounts }) {
  const pathname = usePathname();
  const groups = NAVS[nav];
  const home = groups[0]?.items[0]?.href ?? "/";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={home}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-brand text-brand-foreground">
                  <HeartPulseIcon className="size-4" aria-hidden />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">BHW Attendance</span>
                  <span className="truncate text-xs text-muted-foreground">Barangay Kalawag II</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active =
                  item.href === home ? pathname === item.href : pathname.startsWith(item.href);
                const count = item.badge ? (counts[item.badge] ?? 0) : 0;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link href={item.href} aria-current={active ? "page" : undefined}>
                        <item.icon aria-hidden />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {count > 0 ? (
                      <SidebarMenuBadge
                        className={item.badge === "offline_stations" ? "text-destructive" : undefined}
                        aria-label={`${count} ${item.badge === "offline_stations" ? "offline" : "pending"}`}
                      >
                        {count}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
