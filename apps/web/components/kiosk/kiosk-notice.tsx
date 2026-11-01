import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Large bilingual message for kiosk states that need an administrator (no station, inactive). */
export function KioskNotice({
  icon: Icon,
  title,
  titleFil,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  titleFil: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <Icon className="size-14 text-muted-foreground" aria-hidden />
      <h1 className="text-3xl font-bold text-balance">{title}</h1>
      <p lang="fil" className="text-xl text-muted-foreground text-balance">
        {titleFil}
      </p>
      {description ? <p className="max-w-xl text-lg text-muted-foreground">{description}</p> : null}
      {children ? <div className="flex flex-wrap justify-center gap-3 pt-2">{children}</div> : null}
    </main>
  );
}
