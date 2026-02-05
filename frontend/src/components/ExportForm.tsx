import { useState } from "react";
import toast from "react-hot-toast";

type EntryTypes = "daily" | "individual" | "both";

export default function ExportForm() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [entryTypes, setEntryTypes] = useState<EntryTypes>("both");
  const [includeImages, setIncludeImages] = useState(true);
  const [includeMultimedia, setIncludeMultimedia] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Build query string
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("entryTypes", entryTypes);
      params.set("includeImages", String(includeImages));
      params.set("includeMultimedia", String(includeMultimedia));

      const response = await fetch(`/api/export?${params.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Export failed" }));
        throw new Error(error.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `journalizer-export.${includeMultimedia ? "zip" : "pdf"}`;

      // Download the file
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Leave blank to export all entries
      </p>

      {/* Entry Types */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Entry Types
        </label>
        <div className="flex gap-4">
          {(["both", "daily", "individual"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="radio"
                name="entryTypes"
                value={type}
                checked={entryTypes === type}
                onChange={() => setEntryTypes(type)}
                className="text-gray-900 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">
                {type === "both"
                  ? "All Entries"
                  : type === "daily"
                    ? "Daily Entries"
                    : "Individual Entries"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeImages}
            onChange={(e) => setIncludeImages(e.target.checked)}
            className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
          />
          <span className="text-sm text-gray-700">Include images in PDF</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeMultimedia}
            onChange={(e) => setIncludeMultimedia(e.target.checked)}
            className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
          />
          <span className="text-sm text-gray-700">
            Include audio/video files (downloads as ZIP)
          </span>
        </label>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {isExporting ? "Exporting..." : "Export Journal"}
      </button>
    </div>
  );
}
