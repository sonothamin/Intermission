import { useEffect, useRef, type RefObject } from "react";

/**
 * Adds the `in-view` class to a node when it scrolls into view.
 * Used together with the `.reveal` and `[data-stagger]` CSS hooks to
 * drive subtle reveal animations on the marketing pages.
 *
 * Returns a ref to attach to the element being observed. The ref is
 * stable across renders.
 */
export const useReveal = <T extends HTMLElement>(): RefObject<T> => {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Respect user motion preferences — no animation, but still mark in-view
    // so layout doesn't get stuck at opacity 0.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      node.classList.add("in-view");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
};
