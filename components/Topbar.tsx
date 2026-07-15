"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace_id") || "";

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

      {/* Avatar */}
      <button
        onClick={() => router.push("/auth/sign-out")}
        className="w-[36px] h-[36px] rounded-full flex items-center justify-center font-semibold text-xs border-0 cursor-pointer"
        style={{ background: "var(--clay-soft)", color: "var(--clay)" }}
        title="Sign out"
      >
        PR
      </button>
    </div>
  );
}
