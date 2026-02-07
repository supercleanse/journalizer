import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { api } from "../lib/api";
import type { Habit, HabitLog } from "../types";

interface HabitTrackerProps {
  timezone: string;
}

export default function HabitTracker({ timezone }: HabitTrackerProps) {
  const queryClient = useQueryClient();

  // Default to today in user's timezone
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  const [currentDate, setCurrentDate] = useState(todayStr);

  const { data: habitsData } = useQuery({
    queryKey: ["habits"],
    queryFn: () => api.get<{ habits: Habit[] }>("/api/habits"),
  });

  const { data: logsData } = useQuery({
    queryKey: ["habit-logs", currentDate],
    queryFn: () =>
      api.get<{ logs: HabitLog[] }>(`/api/habits/logs?date=${currentDate}`),
  });

  const toggleMutation = useMutation({
    mutationFn: (data: { date: string; logs: { habitId: string; completed: boolean }[] }) =>
      api.put("/api/habits/logs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habit-logs", currentDate] });
    },
  });

  const activeHabits = (habitsData?.habits ?? []).filter((h) => h.isActive);
  const logsByHabitId = new Map(
    (logsData?.logs ?? []).map((l) => [l.habitId, l])
  );

  if (activeHabits.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-medium text-gray-900">Habits</h3>
        <p className="mt-2 text-xs text-gray-400">
          <a href="/settings" className="text-blue-500 hover:underline">
            Set up habits in Settings
          </a>
        </p>
      </div>
    );
  }

  const navigateDate = (offset: number) => {
    const d = new Date(currentDate + "T12:00:00Z");
    const next = offset > 0 ? addDays(d, offset) : subDays(d, Math.abs(offset));
    setCurrentDate(format(next, "yyyy-MM-dd"));
  };

  const handleToggle = (habitId: string) => {
    const current = logsByHabitId.get(habitId);
    const newCompleted = !(current?.completed ?? false);
    toggleMutation.mutate({
      date: currentDate,
      logs: [{ habitId, completed: newCompleted }],
    });
  };

  const isToday = currentDate === todayStr;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Habits</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigateDate(-1)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Previous day"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[80px] text-center text-xs text-gray-500">
            {isToday ? "Today" : format(new Date(currentDate + "T12:00:00Z"), "MMM d")}
          </span>
          <button
            onClick={() => navigateDate(1)}
            disabled={isToday}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
            title="Next day"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {activeHabits.map((habit) => {
          const log = logsByHabitId.get(habit.id);
          const completed = log?.completed ?? false;
          return (
            <label
              key={habit.id}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={completed}
                onChange={() => handleToggle(habit.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className={completed ? "text-gray-500 line-through" : "text-gray-700"}>
                {habit.name}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
