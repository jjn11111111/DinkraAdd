"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** null = checking; false = not configured; true = client available */
export function useSupabaseReady(): boolean | null {
  const [ready, setReady] = useState<boolean | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setReady(createClient() !== null);
    });
  }, []);

  return ready;
}
