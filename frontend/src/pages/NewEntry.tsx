import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Header from "../components/Header";
import { api } from "../lib/api";
import type { Entry } from "../types";

export default function NewEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const createMutation = useMutation({
    mutationFn: (body: { rawContent: string; entryDate: string }) =>
      api.post<{ entry: Entry }>("/api/entries", body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Entry saved");
      navigate(`/entry/${data.entry.id}`);
    },
    onError: () => toast.error("Failed to save entry"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Write something first");
      return;
    }
    createMutation.mutate({ rawContent: content, entryDate });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">New Entry</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="date"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Date
            </label>
            <input
              id="date"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="content"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              What's on your mind?
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your journal entry..."
              rows={10}
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-gray-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
