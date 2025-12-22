import React from "react";

export default function ProjectPageShell({ header, contextPanel, children }) {
  return (
    <div className="flex flex-col min-h-screen bg-[#ffffff]">
      {/* Full-width header */}
      {header}

      {/* Two-column body */}
      <div className="flex-1 flex gap-6 p-6 max-w-[1800px] mx-auto w-full">
        {/* Left column: Context Panel */}
        <aside className="w-80 flex-shrink-0 hidden lg:block">
          {contextPanel}
        </aside>

        {/* Right column: Main content (tabs) */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}