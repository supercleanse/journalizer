import { useState, useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { format, subDays, parseISO } from "date-fns";
import Header from "../components/Header";
import EntryCard from "../components/EntryCard";
import Calendar from "../components/Calendar";
import { api } from "../lib/api";
import { useDebouncedValue, useIntersectionObserver } from "../lib/hooks";
import type { Entry } from "../types";

interface EntriesResponse {
  entries: Entry[];
  total: number;
  offset: number;
  limit: number;
}

type FilterMode = "all" | "digests" | "individual";

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const unique = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let checkDate = new Date();
  // If no entry today, start from yesterday
  if (unique[0] !== format(checkDate, "yyyy-MM-dd")) {
    const yesterday = format(subDays(checkDate, 1), "yyyy-MM-dd");
    if (unique[0] !== yesterday) return 0;
    checkDate = subDays(checkDate, 1);
  }
  for (const dateStr of unique) {
    if (format(checkDate, "yyyy-MM-dd") === dateStr) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const debouncedSearch = useDebouncedValue(search, 300);

  const limit = 20;

  const buildParams = (pageParam: number) => {
    const offset = (pageParam - 1) * limit;
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterMode === "digests") params.set("entryType", "digest");
    if (filterMode === "individual") params.set("excludeType", "digest");
    if (selectedDate) {
      const d = format(selectedDate, "yyyy-MM-dd");
      params.set("startDate", d);
      params.set("endDate", d);
    }
    return params.toString();
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["entries", debouncedSearch, selectedDate?.toISOString(), filterMode],
    queryFn: ({ pageParam = 1 }) =>
      api.get<EntriesResponse>(`/api/entries?${buildParams(pageParam)}`),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.length * limit;
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const sentinelRef = useIntersectionObserver(
    () => fetchNextPage(),
    !!hasNextPage && !isFetchingNextPage
  );

  const allEntries = useMemo(
    () => data?.pages.flatMap((p) => p.entries) ?? [],
    [data]
  );

  // Fetch all entry dates for calendar highlighting and streak
  const { data: allDatesData } = useQuery({
    queryKey: ["entry-dates"],
    queryFn: () => api.get<{ dates: string[] }>("/api/entries/dates"),
  });

  const entryDates = useMemo(
    () => new Set(allDatesData?.dates ?? []),
    [allDatesData]
  );

  const streak = useMemo(
    () => calculateStreak([...entryDates]),
    [entryDates]
  );

  const monthCount = useMemo(() => {
    const now = new Date();
    return (allDatesData?.dates ?? []).filter((d) => {
      const parsed = parseISO(d);
      return parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
    }).length;
  }, [allDatesData]);

  // Group entries by date
  const grouped = useMemo(() => {
    const groups: Record<string, Entry[]> = {};
    for (const entry of allEntries) {
      const key = entry.entryDate;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [allEntries]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Your Journal</h1>
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
          {(["all", "digests", "individual"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filterMode === mode
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {mode === "all"
                ? "All"
                : mode === "digests"
                  ? "Digests"
                  : "Individual"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries..."
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-6">
          {/* Calendar sidebar (desktop) */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <Calendar
              entryDates={entryDates}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {/* Stats */}
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Streak</span>
                <span className="font-medium text-gray-900">
                  {streak} day{streak !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-gray-500">This month</span>
                <span className="font-medium text-gray-900">
                  {monthCount} entr{monthCount !== 1 ? "ies" : "y"}
                </span>
              </div>
            </div>
          </aside>

          {/* Entry timeline */}
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">
                Loading entries...
              </div>
            ) : grouped.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">
                  {debouncedSearch
                    ? "No entries match your search."
                    : "No entries yet."}
                </p>
                {!debouncedSearch && (
                  <p className="mt-1 text-sm text-gray-400">
                    Create your first entry or send a text to get started.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {grouped.map(([date, entries]) => (
                  <div key={date}>
                    <h2 className="mb-2 text-sm font-medium text-gray-500">
                      {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                    </h2>
                    <div className="space-y-3">
                      {entries.map((entry) => (
                        <EntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-4" />
            {isFetchingNextPage && (
              <div className="py-4 text-center text-sm text-gray-400">
                Loading more...
              </div>
            )}
          </div>
        </div>

        {/* Mobile stats footer */}
        <div className="mt-6 flex items-center justify-center gap-6 border-t border-gray-200 pt-4 text-sm text-gray-500 lg:hidden">
          <span>
            {streak} day streak
          </span>
          <span>
            {monthCount} this month
          </span>
        </div>
      </main>
    </div>
  );
}
