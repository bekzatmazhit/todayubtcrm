import {
  Calendar, Users, BarChart3, Shield, UsersRound, ListTodo,
  FolderOpen, Settings, LogOut, LayoutDashboard, BookOpen, ClipboardCheck, Megaphone, FileText,
  ExternalLink, ChevronRight, MessageCircle, PieChart, Activity, FileSpreadsheet, MoreHorizontal, GraduationCap,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { TodayLogo } from "@/components/TodayLogo";
import { UserAvatar } from "@/components/UserAvatar";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "react-i18next";

const navItems = [
  { titleKey: "Расписание", url: "/", icon: Calendar, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Журнал", url: "/students", icon: Users, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Результаты ЕНТ", url: "/ent-results", icon: BarChart3, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Отчеты", url: "/reports", icon: FileText, roles: ["admin", "umo_head"] },
  { titleKey: "Контрольные тесты", url: "/quiz-results", icon: ClipboardCheck, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "ОС по ученику", url: "/curatorship", icon: Shield, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Админ", url: "/admin", icon: LayoutDashboard, roles: ["admin", "umo_head"] },
];

export function AppSidebar({ onLogout }: { onLogout?: () => void }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const handleLogout = onLogout || logout;

  const filteredItems = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <TodayLogo size={36} className="flex-shrink-0" />
          {!collapsed && <span className="font-heading font-bold text-lg text-foreground">TODAY</span>}
        </div>
        <Separator className="mb-2" />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    {item.disabled ? (
                      <div className="rounded-lg transition-colors opacity-50 cursor-not-allowed flex items-center px-2 py-1.5">
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span className="text-muted-foreground">{t(item.titleKey)}</span>}
                      </div>
                    ) : (
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent/60 rounded-lg transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      >
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{t(item.titleKey)}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 pb-6 flex flex-col gap-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/wiki" className="hover:bg-sidebar-accent/60 rounded-lg transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
                <BookOpen className="mr-3 h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>Wiki</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/settings" className="hover:bg-sidebar-accent/60 rounded-lg transition-colors" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
                <Settings className="mr-3 h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{t("Settings")}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mt-4">
          {!collapsed && user && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted border border-border">
              <UserAvatar user={{ full_name: user.full_name, avatar_url: user.avatar_url }} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role.replace("_", " ")}</p>
              </div>
            </div>
          )}
          {collapsed && user && (
            <div className="flex justify-center mb-2">
              <UserAvatar user={{ full_name: user.full_name, avatar_url: user.avatar_url }} size="sm" />
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
