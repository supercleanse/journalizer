import { useState, useEffect, useRef, useCallback } from "react";

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
