/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single source of truth for folder accent colors.
 * `ListFolder.color` stores one of `FOLDER_COLOR_OPTIONS`.
 * Every folder surface (tab chips, folder cards, mobile menu, drop banners)
 * resolves its palette through `getFolderTheme` so a folder always renders
 * with the color the user actually picked.
 */
export interface FolderTheme {
  /** Solid swatch / dot */
  dot: string;
  /** Hairline border in the accent hue */
  border: string;
  /** Accent text + icon color */
  text: string;
  /** Very subtle tinted surface */
  bg: string;
  /** Active chip styling (bg + border + text + glow) */
  bgActive: string;
  /** Drop-target banner container */
  banner: string;
  /** Drop-target glow for the whole card */
  glow: string;
}

export const FOLDER_COLOR_MAP: Record<string, FolderTheme> = {
  amber: {
    dot: "bg-amber-400",
    border: "border-amber-500/40",
    text: "text-amber-300",
    bg: "bg-amber-500/[0.04]",
    bgActive:
      "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
    banner: "bg-amber-500/10 border-amber-500/50 text-amber-300",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.1)]",
  },
  emerald: {
    dot: "bg-emerald-400",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    bg: "bg-emerald-500/[0.04]",
    bgActive:
      "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
    banner: "bg-emerald-500/10 border-emerald-500/50 text-emerald-300",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.1)]",
  },
  sky: {
    dot: "bg-sky-400",
    border: "border-sky-500/40",
    text: "text-sky-300",
    bg: "bg-sky-500/[0.04]",
    bgActive:
      "bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
    banner: "bg-sky-500/10 border-sky-500/50 text-sky-300",
    glow: "shadow-[0_0_20px_rgba(14,165,233,0.1)]",
  },
  violet: {
    dot: "bg-violet-400",
    border: "border-violet-500/40",
    text: "text-violet-300",
    bg: "bg-violet-500/[0.04]",
    bgActive:
      "bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]",
    banner: "bg-violet-500/10 border-violet-500/50 text-violet-300",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.1)]",
  },
  rose: {
    dot: "bg-rose-400",
    border: "border-rose-500/40",
    text: "text-rose-300",
    bg: "bg-rose-500/[0.04]",
    bgActive:
      "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
    banner: "bg-rose-500/10 border-rose-500/50 text-rose-300",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.1)]",
  },
  teal: {
    dot: "bg-teal-400",
    border: "border-teal-500/40",
    text: "text-teal-300",
    bg: "bg-teal-500/[0.04]",
    bgActive:
      "bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]",
    banner: "bg-teal-500/10 border-teal-500/50 text-teal-300",
    glow: "shadow-[0_0_20px_rgba(20,184,166,0.1)]",
  },
  orange: {
    dot: "bg-orange-400",
    border: "border-orange-500/40",
    text: "text-orange-300",
    bg: "bg-orange-500/[0.04]",
    bgActive:
      "bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.15)]",
    banner: "bg-orange-500/10 border-orange-500/50 text-orange-300",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.1)]",
  },
  indigo: {
    dot: "bg-indigo-400",
    border: "border-indigo-500/40",
    text: "text-indigo-300",
    bg: "bg-indigo-500/[0.04]",
    bgActive:
      "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
    banner: "bg-indigo-500/10 border-indigo-500/50 text-indigo-300",
    glow: "shadow-[0_0_20px_rgba(99,102,241,0.1)]",
  },
};

export const FOLDER_COLOR_OPTIONS = Object.keys(FOLDER_COLOR_MAP);

export const DEFAULT_FOLDER_COLOR = "amber";

/** Resolve a folder's palette, always returning a usable theme. */
export function getFolderTheme(color?: string | null): FolderTheme {
  if (color && FOLDER_COLOR_MAP[color]) return FOLDER_COLOR_MAP[color];
  return FOLDER_COLOR_MAP[DEFAULT_FOLDER_COLOR];
}
