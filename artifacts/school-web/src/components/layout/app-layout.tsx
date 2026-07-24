import { ReactNode, useState } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useSelectedChild } from "@/lib/selected-child-context";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  FileText,
  Bell,
  CreditCard,
  Wallet,
  UserCircle,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Award,
  CalendarDays,
  NotebookPen,
  CalendarOff,
  CalendarClock,
  ShieldAlert,
  LineChart,
  MessageSquare,
  UserPlus,
  History,
  Image,
  Vote,
  FolderOpen,
  CalendarPlus,
  BookOpenCheck,
  Newspaper,
  FolderKanban,
  ClipboardCheck,
  Users2,
  BookOpen as LibraryIcon,
  Bus
} from "lucide-react";
import { NavItem } from "./nav-item";
import { NotificationBell } from "./notification-bell";
import { ChildSwitcher } from "./child-switcher";
import { GlobalSearch } from "./global-search";
import { NotificationPermissionBanner } from "./notification-permission-banner";
import { Button } from "../ui/button";

const navConfig = {
  creator: [
    { href: "/creator/schools", icon: ShieldCheck, label: "Schools" },
  ],
  admin: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/users", icon: ShieldCheck, label: "Users" },
    { href: "/students", icon: Users, label: "Students" },
    { href: "/teachers", icon: GraduationCap, label: "Teachers" },
    { href: "/classes", icon: BookOpen, label: "Classes" },
    { href: "/attendance", icon: CalendarCheck, label: "Attendance" },
    { href: "/staff-attendance", icon: ClipboardCheck, label: "Staff Attendance" },
    { href: "/exams", icon: FileText, label: "Exams" },
    { href: "/homework", icon: NotebookPen, label: "Homework" },
    { href: "/resources", icon: Newspaper, label: "Resources" },
    { href: "/library", icon: LibraryIcon, label: "Library" },
    { href: "/transport", icon: Bus, label: "Transport" },
    { href: "/lesson-planner", icon: FolderKanban, label: "Lesson Planner" },
    { href: "/timetable", icon: CalendarClock, label: "Timetable" },
    { href: "/leave-requests", icon: CalendarOff, label: "Leave Requests" },
    { href: "/discipline", icon: ShieldAlert, label: "Discipline" },
    { href: "/analytics", icon: LineChart, label: "Analytics" },
    { href: "/admissions", icon: UserPlus, label: "Admissions" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/events", icon: CalendarDays, label: "Events" },
    { href: "/gallery", icon: Image, label: "Gallery" },
    { href: "/polls", icon: Vote, label: "Polls" },
    { href: "/custom-pages", icon: FolderOpen, label: "Pages" },
    { href: "/appointments", icon: CalendarPlus, label: "Appointments" },
    { href: "/fees", icon: CreditCard, label: "Fees" },
    { href: "/certificates", icon: Award, label: "Certificates" },
    { href: "/billing", icon: Wallet, label: "Billing" },
    { href: "/audit-log", icon: History, label: "Audit Log" },
  ],
  teacher: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/students", icon: Users, label: "Students" },
    { href: "/attendance", icon: CalendarCheck, label: "Attendance" },
    { href: "/staff-attendance", icon: ClipboardCheck, label: "My Attendance" },
    { href: "/exams", icon: FileText, label: "Exams" },
    { href: "/homework", icon: NotebookPen, label: "Homework" },
    { href: "/resources", icon: Newspaper, label: "Resources" },
    { href: "/library", icon: LibraryIcon, label: "Library" },
    { href: "/lesson-planner", icon: FolderKanban, label: "Lesson Planner" },
    { href: "/timetable", icon: CalendarClock, label: "Timetable" },
    { href: "/leave-requests", icon: CalendarOff, label: "Leave Requests" },
    { href: "/discipline", icon: ShieldAlert, label: "Discipline" },
    { href: "/messages", icon: MessageSquare, label: "Messages" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/events", icon: CalendarDays, label: "Events" },
    { href: "/gallery", icon: Image, label: "Gallery" },
    { href: "/polls", icon: Vote, label: "Polls" },
    { href: "/custom-pages", icon: FolderOpen, label: "Pages" },
    { href: "/appointments", icon: CalendarPlus, label: "Appointments" },
    { href: "/certificates", icon: Award, label: "Certificates" },
  ],
  student: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/my-attendance", icon: CalendarCheck, label: "Attendance" },
    { href: "/my-report-card", icon: FileText, label: "Report Card" },
    { href: "/homework", icon: NotebookPen, label: "Homework" },
    { href: "/resources", icon: Newspaper, label: "Resources" },
    { href: "/timetable", icon: CalendarClock, label: "Timetable" },
    { href: "/subjects", icon: BookOpenCheck, label: "Subjects" },
    { href: "/library", icon: LibraryIcon, label: "Library" },
    { href: "/transport", icon: Bus, label: "Transport" },
    { href: "/leave-requests", icon: CalendarOff, label: "Leave Requests" },
    { href: "/my-certificates", icon: Award, label: "Certificates" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/events", icon: CalendarDays, label: "Events" },
    { href: "/gallery", icon: Image, label: "Gallery" },
    { href: "/polls", icon: Vote, label: "Polls" },
    { href: "/custom-pages", icon: FolderOpen, label: "Pages" },
    { href: "/fees", icon: CreditCard, label: "Fees" },
    { href: "/profile", icon: UserCircle, label: "Profile" },
  ],
  parent: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/homework", icon: NotebookPen, label: "Homework" },
    { href: "/resources", icon: Newspaper, label: "Resources" },
    { href: "/timetable", icon: CalendarClock, label: "Timetable" },
    { href: "/subjects", icon: BookOpenCheck, label: "Subjects" },
    { href: "/library", icon: LibraryIcon, label: "Library" },
    { href: "/transport", icon: Bus, label: "Transport" },
    { href: "/discipline", icon: ShieldAlert, label: "Discipline" },
    { href: "/messages", icon: MessageSquare, label: "Messages" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/events", icon: CalendarDays, label: "Events" },
    { href: "/gallery", icon: Image, label: "Gallery" },
    { href: "/polls", icon: Vote, label: "Polls" },
    { href: "/custom-pages", icon: FolderOpen, label: "Pages" },
    { href: "/appointments", icon: CalendarPlus, label: "Appointments" },
    { href: "/fees", icon: CreditCard, label: "Fees" },
    { href: "/profile", icon: UserCircle, label: "Profile" },
  ],
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAppAuth();
  const { children_ } = useSelectedChild();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const navItems = navConfig[user.role as keyof typeof navConfig] || [];
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  // The creator manages every school, so it keeps the platform's own
  // PathshalaHQ branding; everyone else sees their own school's logo/name
  // once the creator has set one, falling back to PathshalaHQ branding otherwise.
  const brandLogo = user.role !== "creator" && user.schoolLogoUrl ? user.schoolLogoUrl : `${basePath}/logo.png`;
  const brandName = user.role !== "creator" && user.schoolName ? user.schoolName : "PathshalaHQ";

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r w-64 shadow-sm relative z-20">
      <div className="p-6 flex items-center gap-3">
        <img src={brandLogo} alt={brandName} className="w-8 h-8 rounded object-contain" />
        <h1 className="font-bold text-xl tracking-tight text-foreground truncate">{brandName}</h1>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4 px-4 space-y-1">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={location.startsWith(item.href)}
          />
        ))}
        {user.role === 'admin' && (
          <NavItem 
            href="/profile" 
            icon={UserCircle} 
            label="Profile" 
            isActive={location.startsWith("/profile")} 
          />
        )}
        {user.role === 'teacher' && (
          <NavItem
            href="/profile"
            icon={UserCircle}
            label="Profile"
            isActive={location.startsWith("/profile")}
          />
        )}
        {user.role === 'parent' && children_.length >= 2 && (
          <NavItem
            href="/family"
            icon={Users2}
            label="Family Overview"
            isActive={location.startsWith("/family")}
          />
        )}
      </div>

      <div className="p-4 border-t border-border mt-auto bg-muted/30">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border/50 shadow-none transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden print:h-auto print:overflow-visible">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full print:hidden">
        <SidebarContent />
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 ease-in-out z-50 md:hidden print:hidden`}>
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        <div className="print:hidden">
          <NotificationPermissionBanner />
        </div>
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-card z-30 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <img src={brandLogo} alt={brandName} className="w-6 h-6 rounded object-contain shrink-0" />
            <h1 className="font-bold text-lg truncate">{brandName}</h1>
          </div>
          <div className="flex items-center gap-1">
            <ChildSwitcher />
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Desktop Top Bar */}
        <div className="hidden md:flex items-center justify-between gap-2 px-8 py-2 border-b bg-card/50 print:hidden">
          {(user.role === "admin" || user.role === "teacher") ? <GlobalSearch /> : <div />}
          <div className="flex items-center gap-2">
            <ChildSwitcher />
            <NotificationBell />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 print:overflow-visible print:p-0">
          <div className="max-w-6xl mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
