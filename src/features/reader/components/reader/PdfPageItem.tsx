import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";

function applyPdfHighlights(
  container: HTMLDivElement,
  highlights: Array<{ id?: number; text: string; color: string; pageOrLocation: number | string }>,
  onHighlightClick?: (id: number) => void
) {
  const spans = Array.from(container.querySelectorAll("span"));
  if (!spans.length || !highlights.length) return;

  for (const h of highlights) {
    if (!h.text || h.text.trim().length < 2) continue;
    const cleanHText = h.text.replace(/\s+/g, " ").trim().toLowerCase();
    for (const span of spans) {
      const spanText = span.textContent?.replace(/\s+/g, " ").trim().toLowerCase() || "";
      if (
        spanText &&
        (cleanHText.includes(spanText) || spanText.includes(cleanHText)) &&
        spanText.length > 2
      ) {
        span.classList.add("lumina-highlight", `lumina-highlight-${h.color}`);
        span.style.color = "transparent";
        if (h.id) {
          span.setAttribute("data-highlight-id", String(h.id));
          span.title = `Highlight (${h.color}): ${h.text}`;
          span.onclick = (e) => {
            e.stopPropagation();
            if (onHighlightClick && h.id) {
              onHighlightClick(h.id);
            }
          };
        }
      }
    }
  }
}

export function PdfPageItem({
  pdfDoc,
  pageNumber,
  scale,
  pageSize,
  highlights = [],
  onVisible,
  onHighlightClick,
}: {
  pdfDoc: pdfjs.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  pageSize: { width: number; height: number };
  highlights?: Array<{ id?: number; text: string; color: string; pageOrLocation: number | string }>;
  onVisible: (pageNumber: number) => void;
  onHighlightClick?: (id: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const isIntersectingRef = useRef(false);
  const renderTaskRef = useRef<pdfjs.RenderTask | null>(null);

  const expectedWidth = Math.round(pageSize.width * scale);
  const expectedHeight = Math.round(pageSize.height * scale);

  const renderPage = async () => {
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const task = page.render({ canvasContext: ctx, viewport } as never);
      renderTaskRef.current = task;
      await task.promise;

      // Render Text Layer for text selection and in-PDF highlighting
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = "";
        textLayerRef.current.style.setProperty("--total-scale-factor", scale.toString());
        textLayerRef.current.style.setProperty("--scale-factor", scale.toString());
        try {
          const textContent = await page.getTextContent();
          const textLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport,
          });
          await textLayer.render();

          if (highlights.length > 0) {
            applyPdfHighlights(textLayerRef.current, highlights, onHighlightClick);
          }
        } catch {
          // text layer fallback
        }
      }

      setRendered(true);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "name" in err && err.name === "RenderingCancelledException") {
        return;
      }
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isIntersectingRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          onVisible(pageNumber);
          if (!rendered) {
            renderPage();
          }
        }
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, rendered, scale, pdfDoc]);

  useEffect(() => {
    setRendered(false);
    if (isIntersectingRef.current) {
      renderPage();
    }
  }, [scale]);

  // Re-apply in-text highlights when highlights change
  useEffect(() => {
    if (rendered && textLayerRef.current && highlights.length > 0) {
      applyPdfHighlights(textLayerRef.current, highlights, onHighlightClick);
    }
  }, [highlights, rendered]);

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNumber}`}
      className="relative mb-6 shadow-2xl rounded-sm border border-neutral-800 bg-white select-text"
      style={{
        width: `${expectedWidth}px`,
        height: `${expectedHeight}px`,
        "--total-scale-factor": scale,
        "--scale-factor": scale,
      } as React.CSSProperties}
    >
      <canvas ref={canvasRef} className="block" width={expectedWidth} height={expectedHeight} />
      <div
        ref={textLayerRef}
        className="textLayer"
        style={{
          width: `${expectedWidth}px`,
          height: `${expectedHeight}px`,
          "--total-scale-factor": scale,
          "--scale-factor": scale,
        } as React.CSSProperties}
      />
      <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white pointer-events-none z-10">
        Page {pageNumber}
      </div>
    </div>
  );
}
