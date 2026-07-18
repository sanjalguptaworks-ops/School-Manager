import { ReactNode, useState } from "react";
import { useAppAuth } from "@/lib/auth-context";
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
  UserCircle,
  LogOut,
  Menu,
  X,
  ShieldCheck
} from "lucide-react";
import { NavItem } from "./nav-item";
import { Button } from "../ui/button";

const navConfig = {
  admin: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/users", icon: ShieldCheck, label: "Users" },
    { href: "/students", icon: Users, label: "Students" },
    { href: "/teachers", icon: GraduationCap, label: "Teachers" },
    { href: "/classes", icon: BookOpen, label: "Classes" },
    { href: "/attendance", icon: CalendarCheck, label: "Attendance" },
    { href: "/exams", icon: FileText, label: "Exams" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/fees", icon: CreditCard, label: "Fees" },
  ],
  teacher: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/students", icon: Users, label: "Students" },
    { href: "/attendance", icon: CalendarCheck, label: "Attendance" },
    { href: "/exams", icon: FileText, label: "Exams" },
    { href: "/notices", icon: Bell, label: "Notices" },
  ],
  student: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/fees", icon: CreditCard, label: "Fees" },
    { href: "/profile", icon: UserCircle, label: "Profile" },
  ],
  parent: [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/notices", icon: Bell, label: "Notices" },
    { href: "/fees", icon: CreditCard, label: "Fees" },
    { href: "/profile", icon: UserCircle, label: "Profile" },
  ],
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAppAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const navItems = navConfig[user.role as keyof typeof navConfig] || [];
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-card border-r w-64 shadow-sm relative z-20">
      <div className="p-6 flex items-center gap-3">
        <img src={`${basePath}/logo.svg`} alt="EduCore Logo" className="w-8 h-8" />
        <h1 className="font-bold text-xl tracking-tight text-foreground">EduCore</h1>
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
      </div>

      <div className="p-4 border-t border-border mt-auto bg-muted/30">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
            {user.name?.charAt(0).toUpperCase()}
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full">
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
      <div className={`fixed inset-y-0 left-0 transform ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 ease-in-out z-50 md:hidden`}>
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b bg-card z-30">
          <div className="flex items-center gap-2">
            <img src={`${basePath}/logo.svg`} alt="EduCore Logo" className="w-6 h-6" />
            <h1 className="font-bold text-lg">EduCore</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
