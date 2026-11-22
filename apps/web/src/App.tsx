import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";
import { createQueryClient } from "./api";
import { createAppRouter } from "./app/router";
import { startThemeSync } from "./app/theme";

/** Корень приложения: кэш данных (TanStack Query) и роутер. */
export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);
  useEffect(startThemeSync, []);
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
