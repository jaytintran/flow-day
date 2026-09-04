/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Natural language date parsing logic
 * Matches: "tomorrow", "today", "in X days", "d/m/yyyy", "d/m/yy", "d/m"
 */
export function parseSmartDate(
  inputText: string,
  defaultDate: Date,
): { parsedDate: Date; textAfterDateRemoval: string } {
  let cleanText = inputText;
  const targetDate = new Date(defaultDate);

  const tomorrowRegex = /\btomorrow\b/i;
  const todayRegex = /\btoday\b/i;
  const inXDaysRegex = /\bin\s*(\d+)\s*days?\b/i;
  // matches formats like d/m/yyyy or d/m/yy or d/m (e.g., 2/5/2026, 2/6)
  const exactDateRegex = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

  if (tomorrowRegex.test(cleanText)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    cleanText = cleanText.replace(tomorrowRegex, ' ');
  } else if (todayRegex.test(cleanText)) {
    const d = new Date();
    targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    cleanText = cleanText.replace(todayRegex, ' ');
  } else {
    const inXMatch = cleanText.match(inXDaysRegex);
    if (inXMatch) {
      const daysCount = parseInt(inXMatch[1], 10);
      const d = new Date();
      d.setDate(d.getDate() + daysCount);
      targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      cleanText = cleanText.replace(inXDaysRegex, ' ');
    } else {
      const exactMatch = cleanText.match(exactDateRegex);
      if (exactMatch) {
        const day = parseInt(exactMatch[1], 10);
        const month = parseInt(exactMatch[2], 10) - 1;
        const year = exactMatch[3] ? parseInt(exactMatch[3], 10) : new Date().getFullYear();

        let fullYear = year;
        if (exactMatch[3] && exactMatch[3].length === 2) {
          fullYear = 2000 + year;
        }

        const tempDate = new Date(fullYear, month, day);
        if (
          tempDate.getFullYear() === fullYear &&
          tempDate.getMonth() === month &&
          tempDate.getDate() === day
        ) {
          targetDate.setFullYear(fullYear, month, day);
          cleanText = cleanText.replace(exactDateRegex, ' ');
        }
      }
    }
  }

  cleanText = cleanText.trim().replace(/\s+/g, ' ');
  return { parsedDate: targetDate, textAfterDateRemoval: cleanText };
}
