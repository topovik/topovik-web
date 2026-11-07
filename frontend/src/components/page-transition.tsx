import type { ReactNode } from "react";
import { ViewTransition } from "react";

/**
 * Only animate when Link sets transitionTypes (nav-forward / nav-back / none).
 * Suspense fallback → content has no types, so `default: "none"` swaps silently —
 * one animation into the skeleton, then content appears without a second VT.
 */
const routeMotion = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  none: "none",
  default: "none",
} as const;

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition update={routeMotion} default="none">
      {children}
    </ViewTransition>
  );
}
