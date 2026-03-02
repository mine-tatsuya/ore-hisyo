"use client";
// SessionProvider はクライアントコンポーネントなので "use client" が必要

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
