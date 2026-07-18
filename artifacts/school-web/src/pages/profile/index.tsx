import { useAppAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Mail, Clock, LogOut, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

export default function ProfilePage() {
  const { user, logout } = useAppAuth();
  const [, setLocation] = useLocation();
  
  if (!user) return null;

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account details</p>
      </div>

      <Card className="shadow-sm border-border/50 overflow-hidden">
        <div className="h-32 bg-primary/5 w-full relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center p-1 shadow-sm">
              <div className="w-full h-full rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        
        <CardContent className="pt-14 pb-8 px-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
              <p className="text-muted-foreground flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4" /> {user.email}
              </p>
            </div>
            <Badge variant="outline" className="capitalize bg-muted/50 py-1">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              {user.role}
            </Badge>
          </div>

          <div className="mt-8 pt-8 border-t border-border/50 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Account ID</p>
                <p className="font-medium font-mono text-sm">{user.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Member Since</p>
                <p className="font-medium flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {format(new Date(user.createdAt), "MMMM yyyy")}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-border/50">
            <Button 
              variant="destructive" 
              className="w-full sm:w-auto"
              onClick={async () => { await logout(); setLocation("/login"); }}
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}