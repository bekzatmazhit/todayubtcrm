import {
  Calendar, Users, BarChart3, Shield, UsersRound, ListTodo,
  FolderOpen, Settings, LogOut, LayoutDashboard, BookOpen, ClipboardCheck, Megaphone, FileText,
  ExternalLink, ChevronRight, MessageCircle, PieChart,
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
  { titleKey: "Calendar", url: "/", icon: Calendar, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Students", url: "/students", icon: Users, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "ENT Results", url: "/ent-results", icon: BarChart3, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Curatorship", url: "/curatorship", icon: Shield, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Team", url: "/team", icon: UsersRound, roles: ["admin", "umo_head"] },
  { titleKey: "Tasks", url: "/tasks", icon: ListTodo, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Storage", url: "/storage", icon: FolderOpen, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Grades", url: "/grades", icon: ClipboardCheck, roles: ["admin", "umo_head", "teacher"], disabled: true },
  { titleKey: "Broadcasts", url: "/broadcasts", icon: Megaphone, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Chat", url: "/chat", icon: MessageCircle, roles: ["admin", "umo_head", "teacher"], disabled: true },
  { titleKey: "Dashboard", url: "/dashboard", icon: PieChart, roles: ["admin", "umo_head", "teacher"] },
  { titleKey: "Admin", url: "/admin", icon: LayoutDashboard, roles: ["admin", "umo_head"] },
  { titleKey: "Settings", url: "/settings", icon: Settings, roles: ["admin", "umo_head", "teacher"] },
];

export function AppSidebar({ onLogout }: { onLogout?: () => void }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const handleLogout = onLogout || logout;

  const filteredItems = navItems.filter((item) => user && item.roles.includes(user.role));

  const isKnowledgeBaseOpen = location.pathname === "/wiki" || location.pathname === "/docs";

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

              {/* База знаний — Wiki + Docs */}
              <Collapsible defaultOpen={isKnowledgeBaseOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-sidebar-accent/60 rounded-lg transition-colors cursor-pointer">
                      <BookOpen className="mr-3 h-5 w-5 flex-shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1">{t("Knowledge Base")}</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <NavLink
                              to="/wiki"
                              className="hover:bg-sidebar-accent/60 rounded-lg transition-colors"
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                            >
                              <BookOpen className="mr-2 h-4 w-4 flex-shrink-0" />
                              <span>Wiki</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild>
                            <a
                              href="/docs"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:bg-sidebar-accent/60 rounded-lg transition-colors flex items-center"
                            >
                              <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                              <span className="flex-1">{t("Docs")}</span>
                              <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
                            </a>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted mb-2">
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="hover:bg-destructive/10 text-destructive cursor-pointer">
              <LogOut className="mr-3 h-5 w-5" />
              {!collapsed && <span>{t("Logout")}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
