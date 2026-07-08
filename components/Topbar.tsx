"use client";

import { useState } from "react";

export default function Topbar() {
  const [role, setRole] = useState<"dev" | "mgr" | "vp">("mgr");

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
      <div className="flex items-center gap-[10px]">
        <div
          className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center font-bold text-sm text-white"
          style={{ background: "var(--sage)" }}
        >
          Dx
        </div>
        <div className="font-semibold text-base tracking-tight">Dr Codium</div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Role Switch */}
      <div
        className="flex gap-[3px] px-[3px] rounded-[10px]"
        style={{ background: "var(--bg)", border: "1px solid var(--line)" }}
      >
        {(["dev", "mgr", "vp"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className="border-0 font-inherit text-xs px-3 py-[6px] rounded-[7px] cursor-pointer transition-all"
            style={{
              background: role === r ? "#fff" : "transparent",
              color: role === r ? "var(--ink)" : "var(--ink-2)",
              fontWeight: role === r ? "500" : "400",
              boxShadow: role === r ? "var(--shadow)" : "none",
            }}
          >
            {r === "dev"
              ? "Developer"
              : r === "mgr"
                ? "Manager"
                : "Director / VP"}
          </button>
        ))}
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
      <div
        className="w-[36px] h-[36px] rounded-full flex items-center justify-center font-semibold text-xs"
        style={{ background: "var(--clay-soft)", color: "var(--clay)" }}
      >
        PR
      </div>
    </div>
  );
}
