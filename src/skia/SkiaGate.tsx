import type { ReactNode } from 'react';

/** Skia is built into the native apps; only the web preview has to load it first. */
export function SkiaGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
