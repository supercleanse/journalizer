import { useState } from "react";
import { Link } from "react-router-dom";
import type { Entry } from "../types";
import { formatTimeInZone } from "../lib/hooks";

const typeLabels: Record<string, string> = {
  text: "Text",
  photo: "Photo",
  audio: "Audio",
  video: "Video",
  digest: "Daily Digest",
};

const TRUNCATE_LENGTH = 300;

function MediaPreview({ entry }: { entry: Entry }) {
  if (!entry.media || entry.media.length === 0) return null;

  return (
    <div className="space-y-2 px-4 pb-3">
      {entry.media.map((m) => {
        const mime = m.mimeType ?? "";
        if (mime.startsWith("image/")) {
          return (
            <img
              key={m.id}
              src={`/api/media/${m.id}`}
              alt="Photo"
              className="max-h-64 rounded-md"
            />
          );
        }
        if (mime.startsWith("video/")) {
          return (
            <video
              key={m.id}
              controls
              preload="metadata"
              src={`/api/media/${m.id}`}
              className="max-h-64 w-full rounded-md"
            />
          );
        }
        if (mime.startsWith("audio/")) {
          return (
            <audio
              key={m.id}
              controls
              preload="metadata"
              src={`/api/media/${m.id}`}
              className="w-full"
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export default function EntryCard({ entry, timezone }: { entry: Entry; timezone: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const content = entry.polishedContent || entry.rawContent || "";
  const isLong = content.length > TRUNCATE_LENGTH;
  const displayText = showOriginal
    ? entry.rawContent || ""
    : expanded || !isLong
      ? content
      : content.slice(0, TRUNCATE_LENGTH) + "...";
  const hasOriginal =
    entry.rawContent && entry.polishedContent && entry.rawContent !== entry.polishedContent;

  const isDigest = entry.entryType === "digest";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isDigest
          ? "border-purple-200 bg-purple-50/30 hover:border-purple-300"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <Link to={`/entry/${entry.id}`} className="block p-4">
        <div className="mb-2 flex items-center justify-between">
          {isDigest ? (
            <span className="text-xs font-medium text-purple-600">
              Daily Digest
            </span>
          ) : (
            <time className="text-xs text-gray-400">
              {formatTimeInZone(entry.createdAt ?? entry.entryDate, timezone)}
            </time>
          )}
          <div className="flex items-center gap-1.5">
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
            {!isDigest && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {typeLabels[entry.entryType] ?? entry.entryType}
              </span>
            )}
          </div>
        </div>
        {displayText ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
            {displayText}
          </p>
        ) : null}
      </Link>

      {/* Media rendered outside the Link so controls are interactive */}
      <MediaPreview entry={entry} />

      {/* Show more / View original controls */}
      {(isLong || hasOriginal) && (
        <div className="flex gap-3 border-t border-gray-100 px-4 py-2">
          {isLong && !showOriginal && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setExpanded((v) => !v);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          {hasOriginal && (
            <button
              onClick={(e) => {
                e.preventDefault();
                setShowOriginal((v) => !v);
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {showOriginal ? "Show polished" : "View original"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
