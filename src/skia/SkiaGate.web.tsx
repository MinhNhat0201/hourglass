import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useEffect, useState, type ReactNode } from 'react';

/** Loads CanvasKit (copied to public/ by `npm run setup-web`) before rendering. */
export function SkiaGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }).then(() => setReady(true));
  }, []);
  return ready ? <>{children}</> : null;
}
