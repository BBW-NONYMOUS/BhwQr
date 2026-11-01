import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { initials } from "./employee-helpers";

/** Profile photo from a signed URL (private bucket, BR-09) with an initials fallback. */
export function EmployeeAvatar({
  name,
  photoUrl,
  size = "default",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}) {
  const xl = size === "xl";
  return (
    <Avatar size={xl ? "lg" : size} className={cn(xl && "size-20 data-[size=lg]:size-20", className)}>
      {photoUrl ? <AvatarImage src={photoUrl} alt={`Photo of ${name}`} /> : null}
      <AvatarFallback className={cn(xl && "text-xl")} aria-label={photoUrl ? undefined : `${name} (no photo)`}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
