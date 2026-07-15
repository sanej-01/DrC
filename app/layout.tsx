import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import AppChrome from "@/components/AppChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dr Codium",
  description: "AI coaching layer for GitHub pull requests",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-screen overflow-hidden" style={{ background: "var(--bg)", color: "var(--ink)" }}>
        <AuthProvider>
          <AppChrome>{children}</AppChrome>
        </AuthProvider>
      </body>
    </html>
  );
}
