import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { router } from "./router";

export function App() {
  useEffect(() => {
    // Request persistent storage for the PWA so the browser grants the full disk quota
    if ("storage" in navigator && "persist" in navigator.storage) {
      navigator.storage.persist().catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
