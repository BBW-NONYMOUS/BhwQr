import { Suspense, type ReactNode } from "react";

import { AppSidebar } from "@/components/portal/app-sidebar";
import { PortalShellSkeleton } from "@/components/portal/portal-shell-skeleton";
import { SiteHeader } from "@/components/portal/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// The session (cookies) is read inside Suspense so Cache Components can prerender the static shell.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<PortalShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: ReactNode }) {
  const profile = await requireProfile(["admin"]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_dashboard_today");
  const today = data?.[0];

  return (
    <SidebarProvider>
      <AppSidebar
        nav="admin"
        user={{ name: profile.full_name, email: profile.email, roleLabel: "Administrator" }}
        counts={{
          pending_registrations: today?.pending_registrations ?? 0,
          pending_corrections: today?.pending_corrections ?? 0,
          offline_stations: today?.offline_stations ?? 0,
        }}
      />
      <SidebarInset className="min-w-0">
        <SiteHeader nav="admin" section="Admin" />
        <div id="main" className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
