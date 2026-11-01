import { LoaderCircleIcon } from "lucide-react";

export default function KioskLoading() {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <LoaderCircleIcon className="size-12 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-2xl font-semibold">Starting kiosk…</p>
      <p className="text-lg text-muted-foreground">Sinisimulan ang kiosk…</p>
    </div>
  );
}
