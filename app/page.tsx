import Topbar from "@/components/Topbar";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <Topbar />
      <main
        className="flex flex-1 overflow-hidden"
        style={{
          background: "var(--bg)",
        }}
      >
        {/* Placeholder for main content */}
        <div
          className="flex-1 flex flex-col items-center justify-center p-8"
          style={{
            color: "var(--ink-2)",
          }}
        >
          <h1 className="text-2xl font-semibold mb-2">Dr Codium</h1>
          <p className="text-sm">Phase 0.1 scaffold — design tokens & base layout complete</p>
        </div>
      </main>
    </div>
  );
}
