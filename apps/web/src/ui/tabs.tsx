import type { ReactNode } from "react";

export interface TabsProps<T extends string> {
  /** Основа уникальных идентификаторов вкладок и панелей. */
  id: string;
  label: string;
  tabs: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Содержимое выбранной панели. */
  children: ReactNode;
}

/** Горизонтальные вкладки: стрелки перемещают фокус, Enter и пробел выбирают вкладку. */
export function Tabs<T extends string>(_props: TabsProps<T>): ReactNode {
  throw new Error("not implemented");
}
