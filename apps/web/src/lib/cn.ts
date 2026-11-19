import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Склейка классов Tailwind с разрешением конфликтов (как в shadcn/ui). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
