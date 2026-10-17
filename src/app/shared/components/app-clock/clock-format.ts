import { formatDate } from '@angular/common';

export interface ClockParts {
  readonly hours: string;
  readonly minutes: string;
  readonly seconds: string;
  /** Full weekday name, `EEEE`. */
  readonly weekday: string;
  /** The user's `dateFormat` setting applied to the same instant. */
  readonly date: string;
}

/** Splits an instant into the pieces the clock widget lays out. 24-hour clock. */
export function clockParts(time: number, dateFormat: string, locale: string): ClockParts {
  return {
    hours: formatDate(time, 'HH', locale),
    minutes: formatDate(time, 'mm', locale),
    seconds: formatDate(time, 'ss', locale),
    weekday: formatDate(time, 'EEEE', locale),
    date: formatDate(time, dateFormat, locale),
  };
}
