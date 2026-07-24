import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { GraduationCap, Users, CalendarCheck, ShieldCheck } from "lucide-react";

export default function Landing() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-6 lg:px-12 h-20 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={`${basePath}/logo.png`} alt="PathshalaHQ Logo" className="w-11 h-11 object-contain" />
          <span className="text-2xl font-bold tracking-tight text-foreground">PathshalaHQ</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">
            Sign In
          </Link>
          <Button asChild className="rounded-full shadow-sm">
            <Link href="/login">Get Started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            The modern standard for schools
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 leading-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 fill-mode-both">
            Run your school with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-teal-500">precision</span>.
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 fill-mode-both">
            A cohesive platform for administrators, teachers, parents, and students. Say goodbye to scattered spreadsheets and hello to unified clarity.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300 fill-mode-both">
            <Button size="lg" className="h-14 px-8 text-base rounded-full shadow-md" asChild>
              <Link href="/login">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-full border-border/50 bg-background/50 backdrop-blur" asChild>
              <Link href="/login">Sign In to Dashboard</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Features grid */}
      <section className="bg-card/50 py-24 border-t">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard 
            icon={ShieldCheck} 
            title="Admin Control" 
            desc="Manage users, classes, and fees from a unified birds-eye view." 
          />
          <FeatureCard 
            icon={GraduationCap} 
            title="Teacher Portal" 
            desc="Enter marks, track attendance, and publish notices seamlessly." 
          />
          <FeatureCard 
            icon={Users} 
            title="Parent Access" 
            desc="Stay updated on your child's progress, attendance, and fee dues." 
          />
          <FeatureCard 
            icon={CalendarCheck} 
            title="Student Hub" 
            desc="View schedules, upcoming exams, and report cards anywhere." 
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-muted-foreground text-sm border-t bg-background space-y-3">
        <div className="flex items-center justify-center gap-6">
          <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          <Link href="/refund-policy" className="hover:text-primary transition-colors">Refunds</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} PathshalaHQ Inc. Crafted for education.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="p-6 rounded-2xl bg-background border border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
