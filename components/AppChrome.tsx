"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import Topbar from "./Topbar";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname.startsWith("/auth");

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen">
      <Suspense fallback={<div className="h-[60px]" />}>
        <Topbar />
      </Suspense>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
