import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

/**
 * Debounce a value by the given delay in ms.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Intersection Observer hook for infinite scroll.
 * Returns a ref to attach to the sentinel element.
 */
export function useIntersectionObserver(
  callback: () => void,
  enabled: boolean
) {
  const ref = useRef<HTMLDivElement | null>(null);

  const stableCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          stableCallback();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, stableCallback]);

  return ref;
}

/**
 * Returns the user's timezone from settings, falling back to browser timezone.
 */
export function useTimezone(): string {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ timezone: string }>("/api/settings"),
    staleTime: 5 * 60 * 1000,
  });
  return data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a UTC datetime string in the user's timezone.
 * D1 stores datetimes without a Z suffix — treat them as UTC.
 */
export function formatTimeInZone(utcString: string, timezone: string): string {
  const date = utcString.endsWith("Z") ? new Date(utcString) : new Date(utcString + "Z");
  return date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
