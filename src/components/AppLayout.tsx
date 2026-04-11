import { useState, useCallback } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { UserAvatar } from "@/components/UserAvatar";
import { GlobalContextMenu } from "@/components/GlobalContextMenu";
import { CommandPalette } from "@/components/CommandPalette";
import { LogoutConfirmation } from "@/components/LogoutConfirmation";
import { AdminBanner } from "@/components/AdminBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  const requestLogout = useCallback(() => setLogoutOpen(true), []);
  const confirmLogout = useCallback(() => {
    setLogoutOpen(false);
    logout();
  }, [logout]);

  return (
    <SidebarProvider>
      <div className="h-full flex w-full overflow-hidden">
        <AppSidebar onLogout={requestLogout} />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <header className="h-12 md:h-14 flex items-center border-b border-border px-3 md:px-4 bg-card shrink-0">
            <SidebarTrigger className="mr-2 md:mr-4" />
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 md:gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:inline-flex" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}>
                    <Command className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Палитра команд <kbd className="ml-1 font-mono text-[10px]">Ctrl+K</kbd></p>
                </TooltipContent>
              </Tooltip>
              <span className="hidden md:block"><LanguageSwitcher /></span>
              <ThemeSwitcher />
              <NotificationBell />
              <UserAvatar user={{ full_name: user?.full_name, avatar_url: user?.avatar_url }} size="sm" />
            </div>
          </header>
          <AdminBanner />
          <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-3 md:p-6 pb-20 md:pb-6" style={{ overscrollBehavior: 'contain' }}>
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <PwaInstallPrompt />
      <GlobalContextMenu />
      <CommandPalette onLogout={requestLogout} />
      <LogoutConfirmation open={logoutOpen} onOpenChange={setLogoutOpen} onConfirm={confirmLogout} />
    </SidebarProvider>
  );
}
