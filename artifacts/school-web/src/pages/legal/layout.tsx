import { Link } from "wouter";
import type { ReactNode } from "react";

export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 lg:px-12 h-20 flex items-center justify-between border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3">
          <img src={`${basePath}/logo.png`} alt="PathshalaHQ Logo" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold tracking-tight text-foreground">PathshalaHQ</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
          <Link href="/refund-policy" className="hover:text-primary transition-colors">Refunds</Link>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {updated}</p>
          <div className="prose prose-neutral max-w-none space-y-6 text-foreground/90 leading-relaxed [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_li]:mb-1">
            {children}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-muted-foreground text-sm border-t bg-background">
        &copy; {new Date().getFullYear()} PathshalaHQ Inc. Crafted for education.
      </footer>
    </div>
  );
}
