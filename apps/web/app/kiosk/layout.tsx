import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Kiosk",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  colorScheme: "dark",
};

/**
 * Kiosk shell: always dark (the `dark` class switches every design token to its dark value,
 * whatever theme the portal uses) and no portal chrome (design spec "Layout").
 */
export default function KioskLayout({ children }: LayoutProps<"/kiosk">) {
  return (
    <div className="dark flex min-h-svh flex-1 flex-col bg-background text-foreground [color-scheme:dark]">
      {/* Pages read the session (cookies); Suspense lets Cache Components prerender this shell. */}
      <Suspense
        fallback={
          <p className="m-auto text-lg text-muted-foreground" role="status">
            Loading kiosk…
          </p>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}
