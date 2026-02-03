import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Header from "../components/Header";
import { api } from "../lib/api";
import type { Entry } from "../types";

export default function EntryView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["entry", id],
    queryFn: () => api.get<{ entry: Entry }>(`/api/entries/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast.success("Entry deleted");
      navigate("/dashboard");
    },
    onError: () => toast.error("Failed to delete entry"),
  });

  const entry = data?.entry;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="py-12 text-center text-sm text-gray-500">
          Loading...
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="py-12 text-center text-sm text-gray-500">
          Entry not found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </button>

        <article className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <time className="text-sm text-gray-500">
              {format(new Date(entry.entryDate), "EEEE, MMMM d, yyyy")}
            </time>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {entry.entryType}
              </span>
              {entry.source === "sms" && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  SMS
                </span>
              )}
            </div>
          </div>

          {entry.polishedContent && (
            <div className="mb-4">
              <p className="whitespace-pre-line leading-relaxed text-gray-800">
                {entry.polishedContent}
              </p>
            </div>
          )}

          {entry.rawContent && entry.polishedContent && (
            <details className="mt-4 border-t border-gray-100 pt-4">
              <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-600">
                Show original
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm text-gray-500">
                {entry.rawContent}
              </p>
            </details>
          )}

          {entry.rawContent && !entry.polishedContent && (
            <p className="whitespace-pre-line leading-relaxed text-gray-800">
              {entry.rawContent}
            </p>
          )}

          {entry.media && entry.media.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <h3 className="mb-2 text-sm font-medium text-gray-600">
                Attachments
              </h3>
              <div className="space-y-2">
                {entry.media.map((m) => (
                  <div
                    key={m.id}
                    className="text-sm text-gray-500"
                  >
                    {m.originalFilename ?? m.mimeType}
                    {m.sizeBytes && (
                      <span className="ml-2 text-gray-400">
                        ({Math.round(m.sizeBytes / 1024)} KB)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              if (confirm("Delete this entry? This cannot be undone.")) {
                deleteMutation.mutate();
              }
            }}
            className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Delete entry
          </button>
        </div>
      </main>
    </div>
  );
}
