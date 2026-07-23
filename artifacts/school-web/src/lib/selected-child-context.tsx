import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useListParentStudents, getListParentStudentsQueryKey, type ParentStudent } from "@workspace/api-client-react";
import { useAppAuth } from "./auth-context";

interface SelectedChildContextType {
  // Only meaningful for a parent with 2+ linked children -- null otherwise
  // (nothing to switch between, so pages should just fall back to the
  // backend's own "first/only child" default).
  children_: ParentStudent[];
  selectedChildId: number | null;
  setSelectedChildId: (id: number) => void;
}

const SelectedChildContext = createContext<SelectedChildContextType>({
  children_: [],
  selectedChildId: null,
  setSelectedChildId: () => {},
});

function storageKey(parentUserId: number) {
  return `educore:selected-child:${parentUserId}`;
}

export function SelectedChildProvider({ children }: { children: ReactNode }) {
  const { user } = useAppAuth();
  const isParent = user?.role === "parent";
  const { data: linkedChildren } = useListParentStudents(user?.id ?? 0, {
    query: { enabled: isParent && !!user?.id, queryKey: getListParentStudentsQueryKey(user?.id ?? 0) },
  });
  const [selectedChildId, setSelectedChildIdState] = useState<number | null>(null);

  useEffect(() => {
    if (!isParent || !user?.id || !linkedChildren || linkedChildren.length === 0) return;
    const stored = localStorage.getItem(storageKey(user.id));
    const storedId = stored ? parseInt(stored) : null;
    const valid = storedId && linkedChildren.some((c) => c.id === storedId);
    setSelectedChildIdState(valid ? storedId : linkedChildren[0]!.id);
  }, [isParent, user?.id, linkedChildren]);

  const setSelectedChildId = (id: number) => {
    setSelectedChildIdState(id);
    if (user?.id) localStorage.setItem(storageKey(user.id), String(id));
  };

  return (
    <SelectedChildContext.Provider value={{ children_: linkedChildren ?? [], selectedChildId, setSelectedChildId }}>
      {children}
    </SelectedChildContext.Provider>
  );
}

export function useSelectedChild() {
  return useContext(SelectedChildContext);
}
