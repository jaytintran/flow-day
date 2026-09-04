/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseSmartDate } from './dateParser';

// Helper regex tokens for time parsing
export const TIME_TOKEN_PATTERN =
  '(?:now|\\d{1,2}:\\d{2}\\s*(?:am|pm)?|\\d{1,2}\\s*(?:am|pm)\\s*\\d{1,2}|\\d{1,2}\\s*(?:am|pm)|\\d{1,2}\\s*h\\s*\\d{1,2}|\\d{1,2})';
export const fromToRegex = new RegExp(
  '(?:\\s+|^)from\\s*(' + TIME_TOKEN_PATTERN + ')\\s*to\\s*(' + TIME_TOKEN_PATTERN + ')(?=\\s|$)',
  'i',
);
export const atRegex = new RegExp('(?:\\s+|^)at\\s*(' + TIME_TOKEN_PATTERN + ')(?=\\s|$)', 'i');
export const nowStandaloneRegex = /(?:\s+|^)\bnow\b(?=\s|$)/i;
export const durationRegex = /(?:\s+|^)(\d+)\s*h\s*(\d+)?\s*(?:m|min)?(?=\s|$)/i;
export const durationOnlyMinutesRegex = /(?:\s+|^)(\d+)\s*(?:m|min)(?=\s|$)/i;

/**
 * Parse a single time token like "now", "3pm40", "3:45pm", "3pm", "15:30", "3h20", "3"
 */
export function parseSingleTimeToken(
  tokenStr: string,
): { hour: number; minute: number; ampm: string | null; isNow?: boolean } | null {
  if (!tokenStr) return null;
  const s = tokenStr.trim().toLowerCase();

  // Keyword: now
  if (s === 'now') {
    const now = new Date();
    return { hour: now.getHours(), minute: now.getMinutes(), ampm: null, isNow: true };
  }

  // Format: 3:45pm, 3:45 am, 3:45, 15:45
  const colonMatch = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    if (h >= 0 && h <= 24 && m >= 0 && m < 60) {
      return { hour: h, minute: m, ampm: colonMatch[3] || null };
    }
  }

  // Format: 3pm40, 3pm 40, 3am20, 5pm50, 3pm30
  const ampmMinMatch = s.match(/^(\d{1,2})\s*(am|pm)\s*(\d{1,2})$/);
  if (ampmMinMatch) {
    const h = parseInt(ampmMinMatch[1], 10);
    const m = parseInt(ampmMinMatch[3], 10);
    if (h >= 0 && h <= 12 && m >= 0 && m < 60) {
      return { hour: h, minute: m, ampm: ampmMinMatch[2] };
    }
  }

  // Format: 3h40, 15h30
  const hMatch = s.match(/^(\d{1,2})\s*h\s*(\d{1,2})$/);
  if (hMatch) {
    const h = parseInt(hMatch[1], 10);
    const m = parseInt(hMatch[2], 10);
    if (h >= 0 && h <= 24 && m >= 0 && m < 60) {
      return { hour: h, minute: m, ampm: null };
    }
  }

  // Format: 3pm, 3 am
  const ampmOnlyMatch = s.match(/^(\d{1,2})\s*(am|pm)$/);
  if (ampmOnlyMatch) {
    const h = parseInt(ampmOnlyMatch[1], 10);
    if (h >= 0 && h <= 12) {
      return { hour: h, minute: 0, ampm: ampmOnlyMatch[2] };
    }
  }

  // Format: 3, 15 (standalone number)
  const numMatch = s.match(/^(\d{1,2})$/);
  if (numMatch) {
    const h = parseInt(numMatch[1], 10);
    if (h >= 0 && h <= 24) {
      return { hour: h, minute: 0, ampm: null };
    }
  }

  return null;
}

export function resolveHour(hour: number, ampm: string | null): number {
  let h = hour;
  if (ampm === 'pm' && h < 12) {
    h += 12;
  } else if (ampm === 'am' && h === 12) {
    h = 0;
  }
  return h;
}

/**
 * Parse time keyword or time span from text
 */
export function parseSmartTimeSpan(
  inputText: string,
  baseDate: Date,
): {
  parsedStart: Date;
  parsedEnd: Date | null;
  hasSpan: boolean;
  hasTime: boolean;
  textAfterTimeRemoval: string;
} {
  let cleanText = inputText;
  const startAt = new Date(baseDate);
  let endAt: Date | null = null;
  let hasSpan = false;
  let hasTime = false;

  // 1. Try to match "from <time> to <time>"
  const fromToMatch = cleanText.match(fromToRegex);
  if (fromToMatch) {
    const t1 = parseSingleTimeToken(fromToMatch[1]);
    const t2 = parseSingleTimeToken(fromToMatch[2]);

    if (t1 && t2) {
      // Inherit am/pm if one is missing but the other exists (and neither is 'now')
      if (!t1.isNow && !t2.isNow) {
        if (!t1.ampm && t2.ampm && t1.hour < 12) {
          t1.ampm = t2.ampm;
        }
        if (!t2.ampm && t1.ampm && t2.hour < 12) {
          t2.ampm = t1.ampm;
        }
      }

      const startH = t1.isNow ? t1.hour : resolveHour(t1.hour, t1.ampm);
      const endH = t2.isNow ? t2.hour : resolveHour(t2.hour, t2.ampm);

      if (startH >= 0 && startH < 24 && t1.minute >= 0 && t1.minute < 60) {
        startAt.setHours(startH, t1.minute, 0, 0);
        hasTime = true;
      }
      if (endH >= 0 && endH < 24 && t2.minute >= 0 && t2.minute < 60) {
        const calculatedEnd = new Date(startAt);
        calculatedEnd.setHours(endH, t2.minute, 0, 0);
        if (calculatedEnd.getTime() <= startAt.getTime()) {
          calculatedEnd.setDate(calculatedEnd.getDate() + 1);
        }
        endAt = calculatedEnd;
        hasSpan = true;
      }

      cleanText = cleanText.replace(fromToRegex, ' ').trim().replace(/\s+/g, ' ');
    }
  }

  // 2. If no from...to span, try "at <time>"
  if (!hasTime) {
    const atMatch = cleanText.match(atRegex);
    if (atMatch) {
      const t = parseSingleTimeToken(atMatch[1]);
      if (t) {
        const targetHour = t.isNow ? t.hour : resolveHour(t.hour, t.ampm);
        if (targetHour >= 0 && targetHour < 24 && t.minute >= 0 && t.minute < 60) {
          startAt.setHours(targetHour, t.minute, 0, 0);
          hasTime = true;
        }
        cleanText = cleanText.replace(atRegex, ' ').trim().replace(/\s+/g, ' ');
      }
    }
  }

  // 3. If still no time, check for standalone "now"
  if (!hasTime) {
    const nowMatch = cleanText.match(nowStandaloneRegex);
    if (nowMatch) {
      const now = new Date();
      startAt.setHours(now.getHours(), now.getMinutes(), 0, 0);
      hasTime = true;
      cleanText = cleanText.replace(nowStandaloneRegex, ' ').trim().replace(/\s+/g, ' ');
    }
  }

  // 4. Check for trailing duration (e.g. 1h30, 45m)
  const durMatch = cleanText.match(durationRegex);
  if (durMatch) {
    const h = parseInt(durMatch[1], 10);
    const m = durMatch[2] ? parseInt(durMatch[2], 10) : 0;
    const durationMinutes = h * 60 + m;
    endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    hasSpan = true;
    cleanText = cleanText.replace(durationRegex, ' ').trim().replace(/\s+/g, ' ');
  } else {
    const minMatch = cleanText.match(durationOnlyMinutesRegex);
    if (minMatch) {
      const durationMinutes = parseInt(minMatch[1], 10);
      endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
      hasSpan = true;
      cleanText = cleanText.replace(durationOnlyMinutesRegex, ' ').trim().replace(/\s+/g, ' ');
    }
  }

  return {
    parsedStart: startAt,
    parsedEnd: endAt,
    hasSpan,
    hasTime,
    textAfterTimeRemoval: cleanText.trim().replace(/\s+/g, ' '),
  };
}

/**
 * Backward-compatible helper to parse time keyword from text
 */
export function parseSmartTime(
  inputText: string,
  baseDate: Date,
): { parsedDate: Date; textAfterTimeRemoval: string } {
  const result = parseSmartTimeSpan(inputText, baseDate);
  return {
    parsedDate: result.parsedStart,
    textAfterTimeRemoval: result.textAfterTimeRemoval,
  };
}

/**
 * Helper to parse complex timeblock options
 */
export function parseTimeBlock(
  inputText: string,
  defaultStart: Date,
): { title: string; startAt: Date; endAt: Date } {
  let cleanText = inputText;

  // 1. Smart parse date (today, tomorrow, in X days, d/m/y, d/m)
  const { parsedDate: dateBaseline, textAfterDateRemoval } = parseSmartDate(
    cleanText,
    defaultStart,
  );
  cleanText = textAfterDateRemoval;

  // 2. Parse time span or at time + duration
  const spanResult = parseSmartTimeSpan(cleanText, dateBaseline);
  const startAt = spanResult.parsedStart;
  let endAt = spanResult.parsedEnd;

  // Default end is 1 hour after start if not overridden
  if (!endAt) {
    endAt = new Date(startAt);
    endAt.setHours(startAt.getHours() + 1);
  }

  return {
    title: spanResult.textAfterTimeRemoval.trim(),
    startAt,
    endAt,
  };
}
