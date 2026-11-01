import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn / React Native Reusables class merger. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
