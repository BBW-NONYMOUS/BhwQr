import { Suspense, type ReactNode } from "react";

import { AppSidebar } from "@/components/portal/app-sidebar";
import { PortalShellSkeleton } from "@/components/portal/portal-shell-skeleton";
import { SiteHeader } from "@/components/portal/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireProfile } from "@/lib/auth/session";

// The session (cookies) is read inside Suspense so Cache Components can prerender the static shell.
export default function ViewerLayout({ children }: LayoutProps<"/viewer">) {
  return (
    <Suspense fallback={<PortalShellSkeleton />}>
      <ViewerShell>{children}</ViewerShell>
    </Suspense>
  );
}

async function ViewerShell({ children }: { children: ReactNode }) {
  const profile = await requireProfile(["viewer", "admin"]);
  return (
    <SidebarProvider>
      <AppSidebar
        nav="viewer"
        user={{
          name: profile.full_name,
          email: profile.email,
          roleLabel: profile.role === "admin" ? "Administrator" : "Barangay Management (read-only)",
        }}
      />
      <SidebarInset className="min-w-0">
        <SiteHeader nav="viewer" section="Barangay Management" />
        <div id="main" className="mx-auto w-full max-w-[1400px] min-w-0 flex-1 p-4 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
