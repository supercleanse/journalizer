import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Header from "../components/Header";
import { api } from "../lib/api";
import { useTimezone, formatTimeInZone } from "../lib/hooks";
import type { Entry } from "../types";

export default function EntryView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["entry", id],
    queryFn: () => api.get<{ entry: Entry }>(`/api/entries/${id}`),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (body: { polishedContent: string }) =>
      api.put<{ entry: Entry }>(`/api/entries/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry", id] });
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      setIsEditing(false);
      toast.success("Entry updated");
    },
    onError: () => toast.error("Failed to update entry"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entry-dates"] });
      toast.success("Entry deleted");
      navigate("/dashboard");
    },
    onError: () => toast.error("Failed to delete entry"),
  });

  const timezone = useTimezone();
  const entry = data?.entry;
  const isDigest = entry?.entryType === "digest";

  const [showSources, setShowSources] = useState(false);

  const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
    queryKey: ["source-entries", id],
    queryFn: () =>
      api.get<{ entries: Entry[] }>(`/api/entries/${id}/source-entries`),
    enabled: isDigest && showSources,
  });

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

  const startEditing = () => {
    setEditContent(entry.polishedContent || entry.rawContent || "");
    setIsEditing(true);
  };

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

        <article
          className={`rounded-lg border p-6 ${
            isDigest
              ? "border-blue-200 bg-blue-50/30"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <time className="text-sm text-gray-500">
              {format(new Date(entry.entryDate), "EEEE, MMMM d, yyyy")}
            </time>
            <div className="flex items-center gap-2">
              {isDigest ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Daily Entry
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {entry.entryType}
                </span>
              )}
              {entry.source === "sms" && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                  SMS
                </span>
              )}
              {entry.source === "telegram" && (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600">
                  Telegram
                </span>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={12}
                className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-gray-400 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    updateMutation.mutate({
                      polishedContent: editContent,
                    })
                  }
                  disabled={updateMutation.isPending}
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {entry.polishedContent && (
                <p className="whitespace-pre-line leading-relaxed text-gray-800">
                  {entry.polishedContent}
                </p>
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
            </>
          )}

          {/* Media attachments */}
          {entry.media && entry.media.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-medium text-gray-600">
                Attachments
              </h3>
              <div className="space-y-3">
                {entry.media.map((m) => {
                  const mime = m.mimeType ?? "";
                  if (mime.startsWith("image/")) {
                    return (
                      <img
                        key={m.id}
                        src={`/api/media/${m.id}`}
                        alt="Image"
                        className="max-h-96 rounded-md"
                      />
                    );
                  }
                  if (mime.startsWith("audio/")) {
                    return (
                      <div key={m.id}>
                        <p className="mb-1 text-xs text-gray-400">Audio</p>
                        <audio
                          controls
                          src={`/api/media/${m.id}`}
                          className="w-full"
                        />
                      </div>
                    );
                  }
                  if (mime.startsWith("video/")) {
                    return (
                      <div key={m.id}>
                        <p className="mb-1 text-xs text-gray-400">Video</p>
                        <video
                          controls
                          src={`/api/media/${m.id}`}
                          className="max-h-96 w-full rounded-md"
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className="text-sm text-gray-500">
                      {m.mediaType ?? "file"}
                      {m.fileSize && (
                        <span className="ml-2 text-gray-400">
                          ({Math.round(m.fileSize / 1024)} KB)
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Source entries for digests */}
          {isDigest && (
            <div className="mt-4 border-t border-blue-100 pt-4">
              <button
                onClick={() => setShowSources((v) => !v)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                {showSources ? "Hide individual entries" : "View individual entries"}
              </button>
              {showSources && (
                <div className="mt-3 space-y-3">
                  {sourcesLoading ? (
                    <p className="text-sm text-gray-400">
                      Loading source entries...
                    </p>
                  ) : sourcesData?.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      No source entries found.
                    </p>
                  ) : (
                    sourcesData?.entries.map((src) => (
                      <Link
                        key={src.id}
                        to={`/entry/${src.id}`}
                        className="block rounded-md border border-gray-200 bg-white p-3 transition-colors hover:border-gray-300"
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
                          <time>
                            {formatTimeInZone(src.createdAt ?? src.entryDate, timezone)}
                          </time>
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">
                            {src.entryType}
                          </span>
                        </div>
                        {(src.polishedContent || src.rawContent) && (
                          <p className="line-clamp-3 text-sm text-gray-700">
                            {src.polishedContent || src.rawContent}
                          </p>
                        )}
                        {src.media && src.media.length > 0 && (
                          <p className="mt-1 text-xs text-gray-400">
                            {src.media.length} attachment
                            {src.media.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </article>

        {/* Actions */}
        {!isEditing && (
          <div className="mt-4 flex justify-between">
            <button
              onClick={startEditing}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm("Delete this entry? This cannot be undone.")) {
                  deleteMutation.mutate();
                }
              }}
              className="rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
