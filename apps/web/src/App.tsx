import { useState } from "react";
import { RouterProvider } from "react-router";
import { createAppRouter } from "./app/router";

/**
 * Корень приложения. Провайдеры данных (TanStack Query, MSW) добавляет задача #12 здесь же,
 * оборачивая `RouterProvider`.
 */
export function App() {
  const [router] = useState(createAppRouter);
  return <RouterProvider router={router} />;
}
