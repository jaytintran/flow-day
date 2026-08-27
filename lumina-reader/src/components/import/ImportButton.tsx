import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { importBookFile } from "@/lib/importer";
import { keys } from "@/db/hooks";

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await importBookFile(file);
      }
      qc.invalidateQueries({ queryKey: keys.books });
    } catch (err) {
      console.error("Import failed", err);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.epub"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Tooltip>
        {/* @ts-expect-error */}
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{busy ? "Importing…" : "Import books"}</TooltipContent>
      </Tooltip>
    </>
  );
}
