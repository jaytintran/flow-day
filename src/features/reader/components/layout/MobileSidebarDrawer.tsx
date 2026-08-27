import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Bookmark,
  CheckCircle2,
  Users,
  Building2,
  Tag,
  Star,
  Plus,
  X,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollections, useSaveCollections } from "@/db/hooks";
import { useUIStore } from "@/stores/uiStore";
import { Input } from "@/components/ui/input";
import { FolderIcon } from "@/components/folder/FolderPillStrip";

const smartViews = [
  { to: "/authors", label: "Authors", icon: Users },
  { to: "/publishers", label: "Publishers", icon: Building2 },
  { to: "/tags", label: "Tags", icon: Tag },
  { to: "/ratings", label: "Ratings", icon: Star },
];

const secondaryNav = [
  { to: "/wanna-read", label: "Wanna Read", icon: Bookmark },
  { to: "/finished", label: "Finished", icon: CheckCircle2 },
];

export function MobileSidebarDrawer() {
  const open = useUIStore((s) => s.mobileDrawerOpen);
  const setOpen = useUIStore((s) => s.setMobileDrawerOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  const { data: collections = [] } = useCollections();
  const saveCollections = useSaveCollections();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  if (!open) return null;

  const addCollection = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveCollections.mutateAsync([{ name: trimmed, order: collections.length }]);
    setName("");
    setAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative ml-auto flex h-full w-[80%] max-w-sm flex-col bg-card border-l border-border p-5 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-foreground">Menu & Views</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex flex-col gap-5 py-4">
          {/* Status Nav */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
              Status
            </span>
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Collections */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Collections
              </span>
              <button
                type="button"
                onClick={() => setAdding((v) => !v)}
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {adding && (
              <div className="px-2 pb-2">
                <Input
                  autoFocus
                  value={name}
                  placeholder="Collection name"
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCollection();
                    if (e.key === "Escape") setAdding(false);
                  }}
                  onBlur={addCollection}
                  className="h-8 text-sm"
                />
              </div>
            )}

            <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto">
              {collections.length === 0 ? (
                <span className="px-3 py-1.5 text-xs text-muted-foreground">
                  No collections yet
                </span>
              ) : (
                collections.map((col) => (
                  <NavLink
                    key={col.id}
                    to={`/collections/${col.id}`}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors truncate",
                        isActive
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )
                    }
                  >
                    <FolderIcon name={col.icon} className="h-4 w-4 shrink-0 text-primary/80" />
                    <span className="truncate">{col.name}</span>
                  </NavLink>
                ))
              )}
            </div>
          </div>

          {/* Smart Views */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2">
              Smart Views
            </span>
            {smartViews.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Drawer Footer with Settings */}
        <div className="mt-auto pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            <span>App Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
