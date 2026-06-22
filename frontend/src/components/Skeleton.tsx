// =============================================================================
// frontend/src/components/Skeleton.tsx
//
// Tiny themed skeleton block. Renders a soft pulse that matches the
// `bg-theme-tertiary` token used elsewhere in the app. Used by Continue
// Rating and any future lazy-loading surface.
// =============================================================================

import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind sizing classes, e.g. "h-4 w-1/2". The component is block by default. */
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", ...rest }) => (
  <div
    aria-hidden="true"
    className={`rounded-md bg-theme-tertiary animate-pulse ${className}`}
    {...rest}
  />
);

export default Skeleton;
