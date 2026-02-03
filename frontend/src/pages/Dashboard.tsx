import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth } from "date-fns";
import Header from "../components/Header";
import EntryCard from "../components/EntryCard";
import { api } from "../lib/api";
import type { Entry } from "../types";

interface EntriesResponse {
  entries: Entry[];
  total: number;
  page: number;
  limit: number;
}

export default function Dashboard() {
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const limit = 20;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (selectedDate) {
    const d = new Date(selectedDate);
    params.set("from", format(startOfMonth(d), "yyyy-MM-dd"));
    params.set("to", format(endOfMonth(d), "yyyy-MM-dd"));
  }

  const { data, isLoading } = useQuery({
    queryKey: ["entries", page, selectedDate],
    queryFn: () => api.get<EntriesResponse>(`/api/entries?${params}`),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Your Journal</h1>
          <input
            type="month"
            value={selectedDate ?? ""}
            onChange={(e) => {
              setSelectedDate(e.target.value || null);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Loading entries...
          </div>
        ) : !data?.entries.length ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No entries yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first entry or send a text to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
