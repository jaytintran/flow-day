import { NavLink } from "react-router-dom";
import { Home, Heart, BookOpen, Layers, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useBooks } from "@/db/hooks";
import { useNavigate } from "react-router-dom";

export function MobileNav() {
  const setMobileDrawerOpen = useUIStore((s) => s.setMobileDrawerOpen);
  const { data: books = [] } = useBooks();
  const navigate = useNavigate();

  const handleRandomBook = () => {
    if (books.length === 0) return;
    const randomIndex = Math.floor(Math.random() * books.length);
    const chosen = books[randomIndex];
    if (chosen?.id) {
      navigate(`/reader/${chosen.id}`);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background/95 backdrop-blur-md px-2 md:hidden select-none safe-area-bottom">
      <NavLink
        to="/"
        className={({ isActive }) =>
          cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
            isActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )
        }
      >
        <Home className="h-5 w-5" />
        <span>Library</span>
      </NavLink>

      <NavLink
        to="/favorites"
        className={({ isActive }) =>
          cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
            isActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )
        }
      >
        <Heart className="h-5 w-5" />
        <span>Favorites</span>
      </NavLink>

      <button
        type="button"
        onClick={handleRandomBook}
        disabled={books.length === 0}
        aria-label="Random Book"
        className="flex h-11 w-11 -translate-y-2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
      >
        <Shuffle className="h-5 w-5" />
      </button>

      <NavLink
        to="/currently-reading"
        className={({ isActive }) =>
          cn(
            "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors",
            isActive
              ? "text-primary font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )
        }
      >
        <BookOpen className="h-5 w-5" />
        <span>Reading</span>
      </NavLink>

      <button
        type="button"
        onClick={() => setMobileDrawerOpen(true)}
        className="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Layers className="h-5 w-5" />
        <span>More</span>
      </button>
    </nav>
  );
}
