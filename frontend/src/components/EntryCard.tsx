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
  const content = entry.polishedContent || entry.rawContent || "";
  const preview = content.length > 200 ? content.slice(0, 200) + "..." : content;

  return (
    <Link
      to={`/entry/${entry.id}`}
      className="block rounded-lg border border-gray-200 p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <div className="mb-2 flex items-center justify-between">
        <time className="text-sm text-gray-500">
          {format(new Date(entry.entryDate), "EEEE, MMMM d, yyyy")}
        </time>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {typeLabels[entry.entryType] ?? entry.entryType}
        </span>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
        {preview || "No content"}
      </p>
      {entry.source === "sms" && (
        <span className="mt-2 inline-block text-xs text-gray-400">via SMS</span>
      )}
    </Link>
  );
}
