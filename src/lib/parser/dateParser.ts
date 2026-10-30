/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 3, // replaced below
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};
MONTHS.may = 4;

const WEEKDAY_NAMES_REGEX = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
const MONTH_NAMES_REGEX = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

/**
 * Natural language date parsing logic
 * Matches:
 *  - "tomorrow", "today", "in X days"
 *  - "next [weekday]", "this [weekday]", "on [weekday]", or standalone "[weekday]"
 *  - "[month] [day](st|nd|rd|th)?( [year])?" or "[day](st|nd|rd|th)? [month]( [year])?"
 *  - "d/m/yyyy", "d/m/yy", "d/m"
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

  // Weekdays: "next monday", "this friday", "on tuesday", or plain "monday"
  const weekdayRegex = new RegExp(
    `\\b(?:(next|this|on)\\s+)?(${WEEKDAY_NAMES_REGEX})\\b`,
    'i',
  );

  // Textual month dates: "oct 30", "october 30th", "30 oct", "30th october", optionally with year like "30 oct 2026" or "oct 30 2026"
  // Format 1: Month Day (Year?) -> e.g. "oct 30", "december 12th 2026"
  const monthDayRegex = new RegExp(
    `\\b(${MONTH_NAMES_REGEX})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*,?\\s*(\\d{2,4}))?\\b`,
    'i',
  );
  // Format 2: Day Month (Year?) -> e.g. "30 oct", "12th dec", "12 Dec 2026"
  const dayMonthRegex = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_NAMES_REGEX})(?:\\s*,?\\s*(\\d{2,4}))?\\b`,
    'i',
  );

  // matches formats like d/m/yyyy or d/m/yy or d/m (e.g., 2/5/2026, 2/6)
  const exactDateRegex = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

  if (tomorrowRegex.test(cleanText)) {
    const d = new Date(defaultDate);
    d.setDate(d.getDate() + 1);
    targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    cleanText = cleanText.replace(tomorrowRegex, ' ');
  } else if (todayRegex.test(cleanText)) {
    const d = new Date(defaultDate);
    targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    cleanText = cleanText.replace(todayRegex, ' ');
  } else if (inXDaysRegex.test(cleanText)) {
    const inXMatch = cleanText.match(inXDaysRegex);
    if (inXMatch) {
      const daysCount = parseInt(inXMatch[1], 10);
      const d = new Date(defaultDate);
      d.setDate(d.getDate() + daysCount);
      targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      cleanText = cleanText.replace(inXDaysRegex, ' ');
    }
  } else {
    // Check Month-Day / Day-Month textual dates first (e.g. "oct 30", "30 oct", "12 Dec", "dec 12")
    const monthDayMatch = cleanText.match(monthDayRegex);
    const dayMonthMatch = cleanText.match(dayMonthRegex);

    if (monthDayMatch) {
      const monthStr = monthDayMatch[1].toLowerCase();
      const month = MONTHS[monthStr];
      const day = parseInt(monthDayMatch[2], 10);
      const yearStr = monthDayMatch[3];
      const year = yearStr
        ? yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10)
        : defaultDate.getFullYear();

      const tempDate = new Date(year, month, day);
      if (tempDate.getMonth() === month && tempDate.getDate() === day) {
        targetDate.setFullYear(year, month, day);
        cleanText = cleanText.replace(monthDayRegex, ' ');
      }
    } else if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1], 10);
      const monthStr = dayMonthMatch[2].toLowerCase();
      const month = MONTHS[monthStr];
      const yearStr = dayMonthMatch[3];
      const year = yearStr
        ? yearStr.length === 2 ? 2000 + parseInt(yearStr, 10) : parseInt(yearStr, 10)
        : defaultDate.getFullYear();

      const tempDate = new Date(year, month, day);
      if (tempDate.getMonth() === month && tempDate.getDate() === day) {
        targetDate.setFullYear(year, month, day);
        cleanText = cleanText.replace(dayMonthRegex, ' ');
      }
    } else {
      // Check Weekdays (next X, this X, on X, or plain X)
      const weekdayMatch = cleanText.match(weekdayRegex);
      if (weekdayMatch) {
        const prefix = (weekdayMatch[1] || '').toLowerCase();
        const dayName = weekdayMatch[2].toLowerCase();
        const targetWeekday = WEEKDAYS[dayName];

        if (targetWeekday !== undefined) {
          const currentDayOfWeek = defaultDate.getDay();
          let diffDays = targetWeekday - currentDayOfWeek;

          if (prefix === 'next') {
            // "next [weekday]" means the weekday of next week (or at least > 0 days ahead)
            if (diffDays <= 0) diffDays += 7;
            else diffDays += 7; // Next week's instance
          } else if (prefix === 'this') {
            // "this [weekday]": upcoming within the current rolling cycle / week
            if (diffDays <= 0) diffDays += 7;
          } else {
            // "on [weekday]" or standalone "[weekday]": closest upcoming occurrence
            if (diffDays <= 0) diffDays += 7;
          }

          const d = new Date(defaultDate);
          d.setDate(d.getDate() + diffDays);
          targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
          cleanText = cleanText.replace(weekdayRegex, ' ');
        }
      } else {
        // Matches numeric formats like d/m/yyyy, d/m/yy, d/m
        const exactMatch = cleanText.match(exactDateRegex);
        if (exactMatch) {
          const day = parseInt(exactMatch[1], 10);
          const month = parseInt(exactMatch[2], 10) - 1;
          const year = exactMatch[3] ? parseInt(exactMatch[3], 10) : defaultDate.getFullYear();

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
  }

  cleanText = cleanText.trim().replace(/\s+/g, ' ');
  return { parsedDate: targetDate, textAfterDateRemoval: cleanText };
}
