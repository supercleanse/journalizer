import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Header from "../components/Header";
import { api } from "../lib/api";
import type { Entry } from "../types";

export default function NewEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [aiPolish, setAiPolish] = useState(true);
  const [files, setFiles] = useState<File[]>([]);

  const createMutation = useMutation({
    mutationFn: async (body: {
      rawContent?: string;
      entryDate: string;
      polishWithAI: boolean;
      entryType: string;
    }) => {
      const result = await api.post<{ entry: Entry }>("/api/entries", body);

      // Upload media files if any
      if (files.length > 0 && result.entry.id) {
        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("entryId", result.entry.id);
            await api.upload("/api/media/upload", formData);
          } catch {
            toast.error(`Failed to upload ${file.name}`);
          }
        }
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entry-dates"] });
      toast.success("Entry saved");
      navigate(`/entry/${data.entry.id}`);
    },
    onError: () => toast.error("Failed to save entry"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && files.length === 0) {
      toast.error("Write something or attach a file");
      return;
    }
    // Infer entryType from first attached file's MIME type
    let entryType = "text";
    if (files.length > 0) {
      const mime = files[0].type;
      if (mime.startsWith("audio/")) entryType = "audio";
      else if (mime.startsWith("video/")) entryType = "video";
      else entryType = "photo";
    }

    createMutation.mutate({
      rawContent: content.trim() || undefined,
      entryDate,
      polishWithAI: aiPolish,
      entryType,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">New Entry</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
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
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={aiPolish}
                  onChange={(e) => setAiPolish(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-gray-700">AI Polish</span>
              </label>
            </div>
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

          {/* File attachments */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,audio/*,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
            >
              + Attach photo, audio, or video
            </button>

            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 rounded bg-gray-100 px-3 py-1.5 text-sm"
                  >
                    <span className="flex-1 truncate text-gray-700">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {Math.round(file.size / 1024)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
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
