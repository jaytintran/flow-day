import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  Anchor,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Cake,
  Calendar,
  Camera,
  Car,
  Clock,
  Cloud,
  Code2,
  Coffee,
  Compass,
  Crown,
  Droplets,
  Dumbbell,
  Film,
  Flame,
  Folder,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  Headphones,
  Heart,
  Home,
  KeyRound,
  Layers,
  Leaf,
  Lock,
  MapPin,
  Moon,
  Mountain,
  Music,
  Palette,
  PenLine,
  Plane,
  Puzzle,
  Rocket,
  Shield,
  Ship,
  Sparkles,
  Star,
  Sun,
  TreePine,
  Utensils,
  Wine,
  Wrench,
  Zap,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeleteFolder, useFolders, useSaveFolders } from "@/db/hooks";
import type { Folder as FolderT } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// eslint-disable-next-line react-refresh/only-export-components
export const FOLDER_ICONS: { key: string; Icon: LucideIcon }[] = [
  ["book-open", BookOpen],
  ["heart", Heart],
  ["star", Star],
  ["flame", Flame],
  ["sparkles", Sparkles],
  ["music", Music],
  ["film", Film],
  ["briefcase", Briefcase],
  ["wrench", Wrench],
  ["coffee", Coffee],
  ["pen-line", PenLine],
  ["graduation-cap", GraduationCap],
  ["code-2", Code2],
  ["palette", Palette],
  ["globe", Globe],
  ["brain", Brain],
  ["mountain", Mountain],
  ["compass", Compass],
  ["puzzle", Puzzle],
  ["rocket", Rocket],
  ["crown", Crown],
  ["gem", Gem],
  ["shield", Shield],
  ["zap", Zap],
  ["sun", Sun],
  ["moon", Moon],
  ["cloud", Cloud],
  ["droplets", Droplets],
  ["leaf", Leaf],
  ["tree-pine", TreePine],
  ["anchor", Anchor],
  ["ship", Ship],
  ["car", Car],
  ["plane", Plane],
  ["home", Home],
  ["building-2", Building2],
  ["utensils", Utensils],
  ["cake", Cake],
  ["wine", Wine],
  ["gamepad-2", Gamepad2],
  ["dumbbell", Dumbbell],
  ["camera", Camera],
  ["headphones", Headphones],
  ["gift", Gift],
  ["lock", Lock],
  ["key-round", KeyRound],
  ["map-pin", MapPin],
  ["calendar", Calendar],
  ["clock", Clock],
  ["layers", Layers],
].map(([key, Icon]) => ({ key, Icon }) as { key: string; Icon: LucideIcon });

export function FolderIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const entry = FOLDER_ICONS.find((i) => i.key === name);
  const Icon = entry?.Icon ?? Folder;
  return <Icon className={className ?? "h-4 w-4"} />;
}

function FolderPill({
  folder,
  onEdit,
}: {
  folder: FolderT;
  onEdit: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-${folder.id}` });
  return (
    <div
      ref={setNodeRef}
      onContextMenu={(e) => {
        e.preventDefault();
        onEdit();
      }}
      title="Right-click to edit or delete folder"
      className={cn(
        "group flex items-center rounded-md border border-border bg-card py-1 px-3 text-sm transition-colors hover:bg-accent hover:text-foreground cursor-pointer select-none",
        isOver && "border-primary bg-primary/10",
      )}
    >
      <button
        onClick={() =>
          document
            .getElementById(`folder-${folder.id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        className="flex items-center gap-1.5"
      >
        <FolderIcon name={folder.icon} className="h-4 w-4 text-primary" />
        {folder.name}
      </button>
    </div>
  );
}

export function FolderPillStrip({
  scopeType,
  scopeId,
}: {
  scopeType: string;
  scopeId: string;
}) {
  const { data: folders = [] } = useFolders(scopeType, scopeId);
  const saveFolders = useSaveFolders();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<FolderT | null>(null);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveFolders.mutateAsync([
      {
        name: trimmed,
        scopeType: scopeType as "view" | "collection",
        scopeId,
        order: folders.length,
      },
    ]);
    setName("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {folders.map((f) => (
        <FolderPill key={f.id} folder={f} onEdit={() => setEditing(f)} />
      ))}
      {adding ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Folder name"
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
            if (e.key === "Escape") setAdding(false);
          }}
          onBlur={add}
          className="h-8 w-40"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Folder
        </button>
      )}
      {editing && (
        <FolderSettingsDialog
          folder={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FolderSettingsDialog({
  folder,
  onClose,
}: {
  folder: FolderT;
  onClose: () => void;
}) {
  const saveFolders = useSaveFolders();
  const deleteFolder = useDeleteFolder();
  const [name, setName] = useState(folder.name);
  const [icon, setIcon] = useState(folder.icon ?? "");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Folder Settings</DialogTitle>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground">Icon</span>
          <div className="grid max-h-44 grid-cols-10 gap-1.5 overflow-y-auto">
            {FOLDER_ICONS.map(({ key, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(icon === key ? "" : key)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border",
                  icon === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={async () => {
              await deleteFolder.mutateAsync(folder.id!);
              onClose();
            }}
          >
            Delete
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              await saveFolders.mutateAsync([
                {
                  ...folder,
                  name: name.trim() || folder.name,
                  icon: icon || undefined,
                },
              ]);
              onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
