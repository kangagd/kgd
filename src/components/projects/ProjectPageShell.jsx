import React, { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

export default function ProjectPageShell({ header, contextPanel, children }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#ffffff]">
      {/* Full-width header */}
      {header}

      {/* Two-column body */}
      <div className="flex-1 flex gap-6 p-6 max-w-[1800px] mx-auto w-full">
        {/* Left column: Context Panel - Desktop only */}
        <aside className="w-80 flex-shrink-0 hidden lg:block">
          {contextPanel}
        </aside>

        {/* Right column: Main content (tabs) */}
        <main className="flex-1 min-w-0">
          {/* Mobile Customer Button */}
          <div className="lg:hidden mb-4">
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <User className="w-4 h-4 mr-2" />
                  Customer
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                {contextPanel}
              </SheetContent>
            </Sheet>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}