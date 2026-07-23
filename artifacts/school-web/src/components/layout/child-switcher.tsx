import { useSelectedChild } from "@/lib/selected-child-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

// Only renders for a parent with 2+ linked children -- nothing to switch
// between otherwise, so pages just use the backend's own single-child
// default (see e.g. GET /homework's role==="parent" handling).
export function ChildSwitcher() {
  const { children_, selectedChildId, setSelectedChildId } = useSelectedChild();
  if (children_.length < 2) return null;

  return (
    <Select value={selectedChildId ? String(selectedChildId) : undefined} onValueChange={(v) => setSelectedChildId(parseInt(v))}>
      <SelectTrigger className="w-auto max-w-[8rem] sm:max-w-none gap-1.5 h-8 text-sm border-none bg-transparent shadow-none">
        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder="Select child" className="truncate" />
      </SelectTrigger>
      <SelectContent>
        {children_.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>{c.user?.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
