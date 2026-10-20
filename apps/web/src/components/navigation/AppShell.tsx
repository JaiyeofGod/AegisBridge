import * as Dialog from "@radix-ui/react-dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useState, type ReactNode } from "react";

import { GlobalHeader } from "@/components/navigation/GlobalHeader";
import { Sidebar } from "@/components/navigation/Sidebar";

export function AppShell({
  children,
  environmentLabel = "Demo",
}: {
  children: ReactNode;
  environmentLabel?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--text)]">
      <div className="hidden lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </div>

      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(100%,280px)] bg-[var(--surface)] shadow-xl outline-none lg:hidden">
            <VisuallyHidden>
              <Dialog.Title>Navigation</Dialog.Title>
            </VisuallyHidden>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <GlobalHeader environmentLabel={environmentLabel} onOpenNav={() => setMobileOpen(true)} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
