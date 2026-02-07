import type { Habit, HabitLog } from "../types";

interface HabitGridProps {
  date: string;
  habits: Habit[];
  logs: HabitLog[];
}

export default function HabitGrid({ habits, logs }: HabitGridProps) {
  if (habits.length === 0 || logs.length === 0) return null;

  const logsByHabitId = new Map(logs.map((l) => [l.habitId, l]));
  const activeHabits = habits.filter((h) => h.isActive);

  // Only show habits that have a log for this date
  const relevantHabits = activeHabits.filter((h) => logsByHabitId.has(h.id));
  if (relevantHabits.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {relevantHabits.map((habit) => {
          const log = logsByHabitId.get(habit.id);
          const completed = log?.completed ?? false;
          return (
            <span key={habit.id} className="flex items-center gap-1 text-xs text-gray-500">
              {completed ? (
                <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {habit.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
