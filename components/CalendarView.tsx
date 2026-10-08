"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarViewProps {
  /** Recorded date keys (DD-MM-YYYY). */
  markedDates: string[];
  /** Currently selected date key (DD-MM-YYYY). */
  selectedDate: string;
  /** Fired with a DD-MM-YYYY key when a day is clicked. */
  onSelect: (dateKey: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toKey = (date: Date) => format(date, "dd-MM-yyyy");

export default function CalendarView({
  markedDates,
  selectedDate,
  onSelect,
}: CalendarViewProps) {
  const [month, setMonth] = useState(() => new Date());
  const marked = useMemo(() => new Set(markedDates), [markedDates]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const navButton =
    "p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className={navButton}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-white">
          {format(month, "MMMM yyyy")}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className={navButton}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500 mb-1">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toKey(day);
          const inMonth = isSameMonth(day, month);
          const isMarked = marked.has(key);
          const isSelected = key === selectedDate;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={[
                "relative aspect-square rounded-lg text-xs flex items-center justify-center transition",
                inMonth ? "text-slate-200" : "text-slate-600",
                isSelected
                  ? "bg-sky-500 text-white font-semibold"
                  : "hover:bg-slate-800",
              ].join(" ")}
            >
              {format(day, "d")}
              {isMarked && (
                <span
                  className={[
                    "absolute bottom-1 w-1.5 h-1.5 rounded-full",
                    isSelected ? "bg-white" : "bg-sky-400",
                  ].join(" ")}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
