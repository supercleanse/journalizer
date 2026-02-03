import { useState, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";

interface CalendarProps {
  entryDates: Set<string>;
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}

const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function Calendar({
  entryDates,
  selectedDate,
  onSelectDate,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const hasEntry = (date: Date) => entryDates.has(format(date, "yyyy-MM-dd"));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          &lsaquo;
        </button>
        <span className="text-sm font-medium text-gray-700">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          &rsaquo;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {dayNames.map((d) => (
          <div key={d} className="pb-1 text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const hasEntryDot = hasEntry(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() =>
                onSelectDate(isSelected ? null : day)
              }
              className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${
                !inMonth
                  ? "text-gray-300"
                  : isSelected
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {format(day, "d")}
              {hasEntryDot && inMonth && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
