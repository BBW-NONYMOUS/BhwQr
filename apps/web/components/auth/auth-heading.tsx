import type { ReactNode } from "react";

/** Page heading for auth screens: English title with a Filipino line below. */
export function AuthHeading({
  title,
  fil,
  children,
}: {
  title: string;
  fil: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
      <p lang="fil" className="text-muted-foreground">
        {fil}
      </p>
      {children}
    </div>
  );
}
