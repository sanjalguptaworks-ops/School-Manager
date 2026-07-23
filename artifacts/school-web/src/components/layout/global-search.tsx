import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Search, GraduationCap, Users, BookOpen } from "lucide-react";
import { useSearch, getSearchQueryKey } from "@workspace/api-client-react";

const TYPE_ICON: Record<string, typeof Search> = {
  student: Users,
  teacher: GraduationCap,
  class: BookOpen,
};

export function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results, isFetching } = useSearch(
    { q: query },
    { query: { enabled: query.trim().length >= 2, queryKey: getSearchQueryKey({ q: query }) } },
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (link: string) => {
    setOpen(false);
    setQuery("");
    setLocation(link);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search students, teachers, classes…"
          className="w-full h-9 pl-8 pr-3 rounded-md border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {open && query.trim().length >= 2 && (
        <div className="absolute top-full mt-1 w-full bg-popover border rounded-md shadow-md z-50 max-h-80 overflow-y-auto">
          {isFetching ? (
            <p className="text-sm text-muted-foreground text-center py-4">Searching…</p>
          ) : !results || results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No results.</p>
          ) : (
            results.map((r, i) => {
              const Icon = TYPE_ICON[r.type] ?? Search;
              return (
                <button
                  key={`${r.type}-${r.link}-${i}`}
                  onClick={() => handleSelect(r.link)}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-muted/60 transition-colors"
                >
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.sublabel}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
