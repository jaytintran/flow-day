import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { unzipSync } from "fflate";
import { db } from "@/db/db";
import { saveFile } from "@/db/opfs";
import type { Book } from "@/db/schema";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const stripExt = (name: string) => name.replace(/\.[^.]+$/, "");

/** Import one PDF/EPUB: save bytes to OPFS, parse metadata, render a cover, insert a Book row. */
export async function importBookFile(file: File): Promise<Book> {
  const fileType = /\.epub$/i.test(file.name)
    ? "epub"
    : /\.pdf$/i.test(file.name)
      ? "pdf"
      : null;
  if (!fileType) throw new Error(`Unsupported file: ${file.name}`);

  const buffer = await file.arrayBuffer();
  const fileKey = `${crypto.randomUUID()}.${fileType}`;

  let title = stripExt(file.name);
  let author = "Unknown";
  let publisher: string | undefined;
  let description: string | undefined;
  let cover: Blob | null = null;

  if (fileType === "pdf") {
    try {
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      const info = ((await pdf.getMetadata().catch(() => null))?.info ??
        {}) as Record<string, unknown>;
      if (str(info.Title)) title = str(info.Title);
      if (str(info.Author)) author = str(info.Author);
      if (str(info.Subject)) description = str(info.Subject);
      cover = await renderPageCover(pdf);
    } catch (err) {
      console.warn("PDF metadata extraction failed, falling back to default info:", err);
    }
  } else {
    const parsed = parseEpub(buffer);
    title = parsed.title || title;
    author = parsed.author || author;
    publisher = parsed.publisher;
    description = parsed.description;
    cover = parsed.cover;
  }

  await saveFile(fileKey, file);
  let coverKey: string | undefined;
  if (cover) {
    coverKey = `${fileKey}.cover`;
    await saveFile(coverKey, cover);
  }

  const max = await db.books.orderBy("order").last();
  const book: Book = {
    title,
    author,
    publisher,
    description,
    rating: 0,
    tags: [],
    isFavorite: false,
    fileType,
    fileKey,
    coverKey,
    order: max ? max.order + 1 : 0,
    dateAdded: Date.now(),
  };
  await db.books.add(book);
  return book;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Render the first PDF page to a JPEG cover. */
async function renderPageCover(pdf: pdfjs.PDFDocumentProxy): Promise<Blob | null> {
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(300 / base.width, 2) });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvasContext: ctx, canvas, viewport } as never).promise;
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } catch {
    return null;
  }
}

/** Parse an EPUB's OPF metadata + embedded cover image. */
function parseEpub(buffer: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const find = (path: string) => files[path.replace(/\\/g, "/").replace(/^\.\//, "")];

  const container = find("META-INF/container.xml");
  let opfPath = "OEBPS/content.opf";
  if (container) {
    const doc = toXml(container);
    opfPath = doc?.getElementsByTagName("rootfile")[0]?.getAttribute("full-path") ?? opfPath;
  }
  const doc = find(opfPath) ? toXml(find(opfPath)!) : null;

  return {
    title: doc ? tag(doc, "dc:title") : "",
    author: doc ? tag(doc, "dc:creator") : "",
    publisher: doc ? tag(doc, "dc:publisher") || undefined : undefined,
    description: doc ? tag(doc, "dc:description") || undefined : undefined,
    cover: doc ? extractEpubCover(doc, files, opfPath) : null,
  };
}

export interface EpubTocItem {
  id: string;
  label: string;
  href: string;
}

export interface EpubSection {
  id: string;
  href: string;
  html: string;
}

export interface ParsedEpubContent {
  title: string;
  author: string;
  toc: EpubTocItem[];
  sections: EpubSection[];
}

export function parseFullEpub(buffer: ArrayBuffer): ParsedEpubContent {
  const files = unzipSync(new Uint8Array(buffer));
  const find = (path: string) => files[path.replace(/\\/g, "/").replace(/^\.\//, "")];

  const container = find("META-INF/container.xml");
  let opfPath = "OEBPS/content.opf";
  if (container) {
    const doc = toXml(container);
    opfPath = doc?.getElementsByTagName("rootfile")[0]?.getAttribute("full-path") ?? opfPath;
  }

  const opfBytes = find(opfPath);
  if (!opfBytes) {
    throw new Error("Invalid EPUB: content.opf not found");
  }

  const opfDoc = toXml(opfBytes);
  if (!opfDoc) throw new Error("Could not parse content.opf");

  const title = opfDoc.getElementsByTagName("dc:title")[0]?.textContent?.trim() || "Untitled";
  const author = opfDoc.getElementsByTagName("dc:creator")[0]?.textContent?.trim() || "Unknown";

  const opfDir = opfPath.replace(/[^/]*$/, "");
  const resolveHref = (rel: string) => {
    const parts = opfDir.split("/").filter(Boolean);
    for (const part of decodeURIComponent(rel).replace(/^\/+/, "").replace(/\\/g, "/").split("/")) {
      if (part === "..") parts.pop();
      else if (part && part !== ".") parts.push(part);
    }
    return parts.join("/");
  };

  const items = Array.from(opfDoc.getElementsByTagName("item")) as Element[];
  const itemMap = new Map<string, { href: string; mediaType: string }>();
  items.forEach((it: Element) => {
    const id = it.getAttribute("id");
    const href = it.getAttribute("href");
    const mediaType = it.getAttribute("media-type") || "";
    if (id && href) {
      itemMap.set(id, { href: resolveHref(href), mediaType });
    }
  });

  const spineItemrefs = Array.from(opfDoc.getElementsByTagName("itemref")) as Element[];
  const sections: EpubSection[] = [];
  const decoder = new TextDecoder();

  spineItemrefs.forEach((ref: Element, index: number) => {
    const idref = ref.getAttribute("idref");
    if (!idref) return;
    const item = itemMap.get(idref);
    if (!item) return;

    const fileData = files[item.href];
    if (fileData) {
      let html = decoder.decode(fileData);

      // Embed inline images (img src and svg image href / xlink:href)
      html = html.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, (imgTag, src) => {
        try {
          const resolvedImgPath = resolveRelative(item.href, src);
          const imgBytes = files[resolvedImgPath] || files[decodeURIComponent(resolvedImgPath)] || files[src];
          if (imgBytes) {
            const ext = resolvedImgPath.split(".").pop()?.toLowerCase() || "jpeg";
            const mime =
              ext === "png"
                ? "image/png"
                : ext === "gif"
                ? "image/gif"
                : ext === "svg"
                ? "image/svg+xml"
                : ext === "webp"
                ? "image/webp"
                : "image/jpeg";
            const base64 = uint8ToBase64(imgBytes);
            return imgTag.replace(src, `data:${mime};base64,${base64}`);
          }
        } catch {
          // ignore
        }
        return imgTag;
      });

      html = html.replace(/<image\s+[^>]*(?:xlink:href|href)=["']([^"']+)["'][^>]*>/gi, (imgTag, src) => {
        try {
          const resolvedImgPath = resolveRelative(item.href, src);
          const imgBytes = files[resolvedImgPath] || files[decodeURIComponent(resolvedImgPath)] || files[src];
          if (imgBytes) {
            const ext = resolvedImgPath.split(".").pop()?.toLowerCase() || "jpeg";
            const mime =
              ext === "png"
                ? "image/png"
                : ext === "gif"
                ? "image/gif"
                : ext === "svg"
                ? "image/svg+xml"
                : ext === "webp"
                ? "image/webp"
                : "image/jpeg";
            const base64 = uint8ToBase64(imgBytes);
            return imgTag.replace(src, `data:${mime};base64,${base64}`);
          }
        } catch {
          // ignore
        }
        return imgTag;
      });

      // Extract body innerHTML if present to prevent <html> / <head> / style leaks
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) {
        html = bodyMatch[1];
      }

      // Strip scripts and dangerous elements
      html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

      sections.push({
        id: idref || `section-${index}`,
        href: item.href,
        html,
      });
    }
  });

  const toc: EpubTocItem[] = [];
  const ncxItem = Array.from(itemMap.values()).find((i) => i.mediaType === "application/x-dtbncx+xml");
  if (ncxItem && files[ncxItem.href]) {
    const ncxDoc = toXml(files[ncxItem.href]);
    if (ncxDoc) {
      const navPoints = Array.from(ncxDoc.getElementsByTagName("navPoint")) as Element[];
      navPoints.forEach((np: Element, idx: number) => {
        const label = np.getElementsByTagName("text")[0]?.textContent?.trim() || `Chapter ${idx + 1}`;
        const contentSrc = np.getElementsByTagName("content")[0]?.getAttribute("src") || "";
        const [filePath, hash] = contentSrc.split("#");
        const resolvedPath = filePath ? resolveRelative(ncxItem.href, filePath) : "";
        const finalHref = resolvedPath ? (hash ? `${resolvedPath}#${hash}` : resolvedPath) : contentSrc;
        toc.push({
          id: np.getAttribute("id") || `toc-${idx}`,
          label,
          href: finalHref,
        });
      });
    }
  }

  // Fallback to EPUB3 Navigation Document
  if (toc.length === 0) {
    const navItem = items.find((it) => it.getAttribute("properties")?.includes("nav"));
    if (navItem) {
      const rawHref = navItem.getAttribute("href") || "";
      const navHref = resolveHref(rawHref);
      const navBytes = files[navHref];
      if (navBytes) {
        const navDoc = toXml(navBytes);
        if (navDoc) {
          const links = Array.from(navDoc.querySelectorAll("nav[epub\\:type='toc'] a, nav#toc a, nav a"));
          links.forEach((a, idx) => {
            const hrefAttr = a.getAttribute("href") || "";
            const [filePath, hash] = hrefAttr.split("#");
            const resolvedPath = filePath ? resolveRelative(navHref, filePath) : "";
            const finalHref = resolvedPath ? (hash ? `${resolvedPath}#${hash}` : resolvedPath) : hrefAttr;
            const label = a.textContent?.trim() || `Chapter ${idx + 1}`;
            if (label && finalHref) {
              toc.push({
                id: `nav-${idx}`,
                label,
                href: finalHref,
              });
            }
          });
        }
      }
    }
  }

  if (toc.length === 0) {
    sections.forEach((sec, idx) => {
      toc.push({
        id: sec.id,
        label: `Section ${idx + 1}`,
        href: sec.href,
      });
    });
  }

  return {
    title,
    author,
    toc,
    sections,
  };
}

function toXml(bytes: Uint8Array): Document | null {
  try {
    const text = new TextDecoder().decode(bytes);
    const doc = new DOMParser().parseFromString(text, "application/xml");
    return doc.getElementsByTagName("parsererror").length ? null : doc;
  } catch {
    return null;
  }
}

function tag(doc: Document, tagName: string): string {
  const el = doc.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() ?? "";
}

function extractEpubCover(
  doc: Document | null,
  files: Record<string, Uint8Array>,
  opfPath: string
): Blob | null {
  try {
    const opfDir = opfPath.replace(/[^/]*$/, "");
    let coverHref: string | null = null;

    if (doc) {
      // 1. EPUB 2 <meta name="cover" content="item-id">
      const metaTags = Array.from(doc.getElementsByTagName("meta"));
      for (const meta of metaTags) {
        if (meta.getAttribute("name")?.toLowerCase() === "cover") {
          const coverId = meta.getAttribute("content");
          if (coverId) {
            const item = Array.from(doc.getElementsByTagName("item")).find(
              (it) => it.getAttribute("id") === coverId
            );
            if (item) {
              coverHref = item.getAttribute("href");
              break;
            }
          }
        }
      }

      // 2. EPUB 3 <item properties="cover-image">
      if (!coverHref) {
        const items = Array.from(doc.getElementsByTagName("item"));
        for (const item of items) {
          const props = (item.getAttribute("properties") || "").toLowerCase();
          if (props.includes("cover-image")) {
            coverHref = item.getAttribute("href");
            break;
          }
        }
      }

      // 3. Item id heuristic (cover, cover-image, book-cover, id-cover, titlepage)
      if (!coverHref) {
        const items = Array.from(doc.getElementsByTagName("item"));
        for (const item of items) {
          const id = (item.getAttribute("id") || "").toLowerCase();
          const mediaType = (item.getAttribute("media-type") || "").toLowerCase();
          if (
            mediaType.startsWith("image/") &&
            (id === "cover" ||
              id === "cover-image" ||
              id === "coverimage" ||
              id.includes("cover") ||
              id.includes("titlepage"))
          ) {
            coverHref = item.getAttribute("href");
            break;
          }
        }
      }

      // 4. Item href heuristic (contains cover or titlepage)
      if (!coverHref) {
        const items = Array.from(doc.getElementsByTagName("item"));
        for (const item of items) {
          const href = (item.getAttribute("href") || "").toLowerCase();
          const mediaType = (item.getAttribute("media-type") || "").toLowerCase();
          if (mediaType.startsWith("image/") && (href.includes("cover") || href.includes("titlepage"))) {
            coverHref = item.getAttribute("href");
            break;
          }
        }
      }
    }

    let coverBytes: Uint8Array | undefined;
    let resolvedPath = "";

    if (coverHref) {
      resolvedPath = resolveRelative(opfDir ? `${opfDir}dummy` : "", coverHref);
      coverBytes =
        files[resolvedPath] ||
        files[coverHref] ||
        files[decodeURIComponent(resolvedPath)] ||
        files[decodeURIComponent(coverHref)];
    }

    // 5. Fallback: Directly search files map for cover image files
    if (!coverBytes || coverBytes.length === 0) {
      const fileKeys = Object.keys(files);
      const matchedKey =
        fileKeys.find((k) => /(^|\/)(cover|titlepage|frontcover)\.(jpe?g|png|webp|gif)$/i.test(k)) ||
        fileKeys.find((k) => /cover.*\.(jpe?g|png|webp)$/i.test(k)) ||
        fileKeys.find((k) => /\.(jpe?g|png|webp)$/i.test(k) && !k.includes("ad"));

      if (matchedKey) {
        coverBytes = files[matchedKey];
        resolvedPath = matchedKey;
      }
    }

    if (!coverBytes || coverBytes.length === 0) return null;

    const ext = (resolvedPath.split(".").pop() || "jpeg").toLowerCase();
    const mime =
      ext === "png"
        ? "image/png"
        : ext === "gif"
        ? "image/gif"
        : ext === "webp"
        ? "image/webp"
        : ext === "svg"
        ? "image/svg+xml"
        : "image/jpeg";

    return new Blob([coverBytes as unknown as BlobPart], { type: mime });
  } catch {
    return null;
  }
}

function resolveRelative(baseFile: string, relPath: string): string {
  const dir = baseFile.replace(/[^/]*$/, "");
  const parts = dir.split("/").filter(Boolean);
  for (const part of decodeURIComponent(relPath).replace(/^\/+/, "").replace(/\\/g, "/").split("/")) {
    if (part === "..") parts.pop();
    else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
