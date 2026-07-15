"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authedFetch } from "@/lib/authed-fetch";

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id") || "";

  const [menuOpen, setMenuOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [statusText, setStatusText] = useState<{ text: string; isError: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeRole = pathname.startsWith("/manager")
    ? "mgr"
    : pathname.startsWith("/dashboard")
      ? "dev"
      : null;

  const goTo = (role: "dev" | "mgr" | "vp") => {
    if (role === "dev") {
      router.push(`/dashboard${workspaceId ? `?workspace_id=${workspaceId}` : ""}`);
    } else if (role === "mgr") {
      router.push(`/manager/team${workspaceId ? `?workspace_id=${workspaceId}` : ""}`);
    }
    // VP dashboard doesn't exist yet — tab is disabled below
  };

  // Close the menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  const handleScan = async () => {
    setIsScanning(true);
    setStatusText(null);
    try {
      const scanResponse = await authedFetch("/api/manager/scan-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const scanData = await scanResponse.json();
      if (!scanResponse.ok) throw new Error(scanData.error || "Scan failed");

      await authedFetch("/api/manager/score-prs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });

      setStatusText({
        text: `Scanned ${scanData.repos_scanned} repo(s), enqueued ${scanData.prs_enqueued} PR(s)`,
        isError: false,
      });
      router.refresh();
    } catch (err) {
      setStatusText({
        text: err instanceof Error ? err.message : "Scan failed",
        isError: true,
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleClear = async () => {
    if (
      !confirm(
        "Clear all PR scores AND PR history for this workspace? This cannot be undone."
      )
    ) {
      return;
    }
    setIsClearing(true);
    setStatusText(null);
    try {
      const response = await authedFetch("/api/manager/clear-pr-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to clear");

      setStatusText({
        text: `Cleared ${data.scores_cleared} score(s) and ${data.prs_cleared} PR(s)`,
        isError: false,
      });
      router.refresh();
    } catch (err) {
      setStatusText({
        text: err instanceof Error ? err.message : "Failed to clear",
        isError: true,
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-[18px] px-6 h-[60px]"
      style={{
        background: "rgba(255,255,255,.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {/* Brand */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-[10px] border-0 bg-transparent cursor-pointer"
      >
        <div
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center font-bold text-sm text-white"
          style={{ background: "var(--sage)" }}
        >
          Dx
        </div>
        <div className="font-semibold text-base tracking-tight">Dr Codium</div>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Role Switch */}
      <div
        className="flex gap-[3px] px-[3px] rounded-[10px]"
        style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
      >
        {(["dev", "mgr", "vp"] as const).map((r) => {
          const disabled = r === "vp";
          const isActive = activeRole === r;
          return (
            <button
              key={r}
              onClick={() => !disabled && goTo(r)}
              disabled={disabled}
              className="border-0 font-inherit text-xs px-3 py-[6px] rounded-[7px] transition-all"
              style={{
                background: isActive ? "#fff" : "transparent",
                color: disabled ? "var(--line)" : isActive ? "var(--ink)" : "var(--ink-2)",
                fontWeight: isActive ? "500" : "400",
                boxShadow: isActive ? "var(--shadow)" : "none",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
              title={disabled ? "Coming soon" : undefined}
            >
              {r === "dev"
                ? "Developer"
                : r === "mgr"
                  ? "Manager"
                  : "Director / VP"}
            </button>
          );
        })}
      </div>

      {/* Bell */}
      <button
        className="w-[36px] h-[36px] rounded-[10px] border text-base cursor-pointer"
        style={{
          border: "1px solid var(--line)",
          background: "#fff",
          color: "var(--ink-2)",
        }}
      >
        🔔
      </button>

      {/* Avatar + dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-[36px] h-[36px] rounded-full flex items-center justify-center font-semibold text-xs border-0 cursor-pointer"
          style={{ background: "var(--clay-soft)", color: "var(--clay)" }}
          title="Account menu"
        >
          PR
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-[46px] w-[280px] rounded-[10px] overflow-hidden z-50"
            style={{
              background: "#fff",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow)",
            }}
          >
            {workspaceId && (
              <>
                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="w-full text-left px-4 py-3 text-sm border-0 bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  style={{ color: "var(--ink)" }}
                >
                  {isScanning ? "Scanning & scoring…" : "Scan GitHub Now"}
                </button>
                <button
                  onClick={handleClear}
                  disabled={isClearing}
                  className="w-full text-left px-4 py-3 text-sm border-0 bg-transparent cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  style={{ color: "var(--bad)" }}
                >
                  {isClearing ? "Clearing…" : "Clear PR Scores & History"}
                </button>
                {statusText && (
                  <div
                    className="px-4 py-2 text-xs"
                    style={{
                      color: statusText.isError ? "var(--bad)" : "var(--ink-2)",
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    {statusText.text}
                  </div>
                )}
                <div style={{ borderTop: "1px solid var(--line)" }} />
              </>
            )}
            <button
              onClick={() => router.push("/auth/sign-out")}
              className="w-full text-left px-4 py-3 text-sm border-0 bg-transparent cursor-pointer hover:bg-gray-50"
              style={{ color: "var(--ink)" }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
