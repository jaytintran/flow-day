import { useState } from "react";
import { db } from "@/db/db";
import { useUpdateBook } from "@/db/hooks";
import type { Book, ReadingStatus } from "@/db/schema";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUSES: { value: ReadingStatus; label: string }[] = [
  { value: "currently-reading", label: "Currently Reading" },
  { value: "wanna-read", label: "Wanna Read" },
  { value: "finished", label: "Finished" },
];

export function BulkEditModal({
  ids,
  onClose,
}: {
  ids: number[];
  onClose: () => void;
}) {
  const updateBook = useUpdateBook();
  const [status, setStatus] = useState("");
  const [favorite, setFavorite] = useState<boolean | null>(null);
  const [tags, setTags] = useState("");

  const apply = async () => {
    const newTags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const id of ids) {
      const patch: Partial<Book> = {};
      if (status) patch.readingStatus = status as ReadingStatus;
      if (favorite !== null) patch.isFavorite = favorite;
      if (newTags.length) {
        const book = await db.books.get(id);
        patch.tags = [...new Set([...(book?.tags ?? []), ...newTags])];
      }
      await updateBook.mutateAsync({ id, patch });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit ({ids.length} books)</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Reading status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">— Leave unchanged —</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            Favorite
            <div className="flex gap-2">
              <Button
                variant={favorite === true ? "default" : "outline"}
                size="sm"
                onClick={() => setFavorite(true)}
              >
                Mark favorite
              </Button>
              <Button
                variant={favorite === false ? "default" : "outline"}
                size="sm"
                onClick={() => setFavorite(false)}
              >
                Unfavorite
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFavorite(null)}
              >
                Skip
              </Button>
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Add tags (comma separated)
            <Input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
