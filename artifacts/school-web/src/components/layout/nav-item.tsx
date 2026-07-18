import { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
}

export function NavItem({ href, icon: Icon, label, isActive }: NavItemProps) {
  return (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group text-sm font-medium",
        isActive 
          ? "bg-primary/10 text-primary" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn(
        "w-5 h-5 transition-transform duration-200", 
        isActive ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground"
      )} />
      <span>{label}</span>
    </Link>
  );
}
