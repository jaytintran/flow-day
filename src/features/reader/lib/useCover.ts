import { useEffect, useState } from "react";
import { readObjectUrl } from "@/db/opfs";

/** Load a cover from OPFS as a temporary object URL, revoked on cleanup. */
export function useCover(coverKey?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!coverKey) {
      setUrl(null);
      return;
    }
    let alive = true;
    let current: string | null = null;
    readObjectUrl(coverKey).then((u) => {
      if (!alive) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      current = u;
      setUrl(u);
    });
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
    };
  }, [coverKey]);

  return url;
}
