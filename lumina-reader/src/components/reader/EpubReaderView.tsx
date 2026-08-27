import { useEffect, useRef } from "react";
import type { ParsedEpubContent } from "@/lib/importer";

function highlightEpubHtml(
  rawHtml: string,
  sectionIdx: number,
  highlights: Array<{ id?: number; text: string; color: string; pageOrLocation: number | string }>
): string {
  if (!rawHtml || highlights.length === 0) return rawHtml;
  let html = rawHtml;
  const sectionHighlights = highlights.filter(
    (h) => Number(h.pageOrLocation) === sectionIdx + 1 || !h.pageOrLocation
  );

  for (const h of sectionHighlights) {
    if (!h.text || h.text.trim().length < 2) continue;
    try {
      const trimmed = h.text.trim();
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(?![^<]*>)(${escaped})`, "gi");
      html = html.replace(
        regex,
        `<mark class="lumina-highlight lumina-highlight-${h.color}" data-highlight-id="${h.id || ""}" title="Highlight (${h.color}): ${trimmed}">$1</mark>`
      );
    } catch {
      // ignore
    }
  }
  return html;
}

export function EpubReaderView({
  epubDoc,
  epubFontSize,
  highlights = [],
  onVisibleSection,
}: {
  epubDoc: ParsedEpubContent;
  epubFontSize: number;
  highlights?: Array<{ id?: number; text: string; color: string; pageOrLocation: number | string }>;
  onVisibleSection?: (sectionIdx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track currently visible section on scroll
  useEffect(() => {
    if (!onVisibleSection || !containerRef.current) return;
    const sectionEls = containerRef.current.querySelectorAll<HTMLElement>("[data-section-index]");
    if (!sectionEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          const idx = Number(visible.target.getAttribute("data-section-index"));
          if (!Number.isNaN(idx)) {
            onVisibleSection(idx);
          }
        }
      },
      { threshold: 0.15, rootMargin: "-10% 0px -70% 0px" }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [epubDoc, onVisibleSection]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center w-full max-w-3xl pb-24 gap-6 select-text text-left"
      style={{ fontSize: `${epubFontSize}%` }}
    >
      {epubDoc.sections.map((sec, idx) => {
        const chapterLabel = epubDoc.toc[idx]?.label || `Section ${idx + 1}`;
        const processedHtml = highlightEpubHtml(sec.html, idx, highlights);

        return (
          <article
            key={sec.id || idx}
            id={`epub-sec-${idx}`}
            data-section-index={idx}
            className="w-full rounded-2xl bg-card/95 text-foreground shadow-xl border border-border/80 p-6 md:p-12 transition-all leading-relaxed font-serif text-[1.05rem]"
          >
            {/* Chapter Header Banner */}
            <div className="mb-8 pb-3 border-b border-border/60 flex items-center justify-between not-prose">
              <span className="text-xs font-sans font-bold tracking-wider text-primary uppercase">
                {chapterLabel}
              </span>
              <span className="text-[11px] font-sans text-muted-foreground tabular-nums">
                {idx + 1} / {epubDoc.sections.length}
              </span>
            </div>

            {/* Clean Section Content */}
            <div
              className="epub-section-content text-left text-neutral-200 space-y-5 leading-[1.85] font-serif
                [&_p]:text-left [&_p]:mb-5 [&_p]:leading-[1.85] [&_p]:text-neutral-200
                [&_h1]:text-left [&_h1]:font-sans [&_h1]:font-bold [&_h1]:text-2xl [&_h1]:text-foreground [&_h1]:mt-8 [&_h1]:mb-4
                [&_h2]:text-left [&_h2]:font-sans [&_h2]:font-bold [&_h2]:text-xl [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-3
                [&_h3]:text-left [&_h3]:font-sans [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:text-foreground [&_h3]:mt-5 [&_h3]:mb-2
                [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:my-5 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:bg-primary/5 [&_blockquote]:py-2 [&_blockquote]:rounded-r
                [&_ul]:text-left [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-4 [&_ul]:space-y-1
                [&_ol]:text-left [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-4 [&_ol]:space-y-1
                [&_li]:text-left [&_li]:leading-relaxed
                [&_img]:block [&_img]:mx-auto [&_img]:max-w-full [&_img]:max-h-[75vh] [&_img]:object-contain [&_img]:my-6 [&_img]:rounded-lg [&_img]:shadow-md
                [&_figure]:my-6 [&_figure]:text-center
                [&_figcaption]:text-xs [&_figcaption]:text-muted-foreground [&_figcaption]:mt-2 [&_figcaption]:italic
                [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
                [&_hr]:my-8 [&_hr]:border-border/60
              "
              dangerouslySetInnerHTML={{
                __html: processedHtml || "<p>Empty section</p>",
              }}
            />
          </article>
        );
      })}
    </div>
  );
}
