import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import type { Entry } from "../types";

const typeLabels: Record<string, string> = {
  text: "Text",
  photo: "Photo",
  audio: "Audio",
  video: "Video",
};

export default function EntryCard({ entry }: { entry: Entry }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const content = entry.polishedContent || entry.rawContent || "";
  const preview = content.length > 300 ? content.slice(0, 300) + "..." : content;
  const hasOriginal =
    entry.rawContent && entry.polishedContent && entry.rawContent !== entry.polishedContent;

  return (
    <div className="rounded-lg border border-gray-200 bg-white transition-colors hover:border-gray-300">
      <Link to={`/entry/${entry.id}`} className="block p-4">
        <div className="mb-2 flex items-center justify-between">
          <time className="text-xs text-gray-400">
            {format(new Date(entry.createdAt ?? entry.entryDate), "h:mm a")}
          </time>
          <div className="flex items-center gap-1.5">
            {entry.source === "sms" && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                SMS
              </span>
            )}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {typeLabels[entry.entryType] ?? entry.entryType}
            </span>
          </div>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
          {showOriginal ? entry.rawContent : preview || "No content"}
        </p>
      </Link>

      {hasOriginal && (
        <div className="border-t border-gray-100 px-4 py-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              setShowOriginal((v) => !v);
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showOriginal ? "Show polished" : "View original"}
          </button>
        </div>
      )}
    </div>
  );
}
