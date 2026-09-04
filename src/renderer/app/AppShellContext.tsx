import React, { createContext, useContext } from "react";
import type { AppShellValue } from "./types";

const AppShellContext = createContext<AppShellValue | null>(null);

export function AppShellProvider({
  value,
  children
}: {
  value: AppShellValue;
  children: React.ReactNode;
}) {
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShellValue {
  const value = useContext(AppShellContext);
  if (!value) throw new Error("useAppShell requires AppShellProvider");
  return value;
}
