import { useState, useEffect, useMemo, useRef } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import Header from "../components/Header";
import ExportForm from "../components/ExportForm";
import EmailSubscriptionForm from "../components/EmailSubscriptionForm";
import { api } from "../lib/api";
import type { User, Reminder, DictionaryTerm } from "../types";

const voiceStyles = [
  { value: "natural", label: "Natural" },
  { value: "conversational", label: "Conversational" },
  { value: "reflective", label: "Reflective" },
  { value: "polished", label: "Polished" },
];

function getUtcOffset(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return offset.replace("GMT", "UTC");
  } catch {
    return "";
  }
}

const ALL_TIMEZONES = Intl.supportedValuesOf("timeZone");
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface TimezoneOption {
  value: string;
  label: string;
  region: string;
  offset: string;
}

function buildTimezoneOptions(): TimezoneOption[] {
  return ALL_TIMEZONES.map((tz) => {
    const offset = getUtcOffset(tz);
    const region = tz.split("/")[0];
    const city = tz.replace(/_/g, " ");
    return { value: tz, label: `${city} (${offset})`, region, offset };
  });
}

function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (tz: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => buildTimezoneOptions(), []);

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.value.toLowerCase().includes(q) ||
        o.label.toLowerCase().includes(q)
    );
  }, [options, search]);

  // Group by region
  const grouped = useMemo(() => {
    const groups: Record<string, TimezoneOption[]> = {};
    for (const o of filtered) {
      if (!groups[o.region]) groups[o.region] = [];
      groups[o.region].push(o);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setSearch("");
        }}
        className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm"
      >
        <span className="truncate">{selectedLabel}</span>
        <svg
          className="ml-2 h-4 w-4 shrink-0 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search timezones..."
              autoFocus
              className="w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto px-1 pb-1">
            {value !== detectedTimezone && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(detectedTimezone);
                    setOpen(false);
                  }}
                  className="w-full rounded px-3 py-1.5 text-left text-sm text-blue-600 hover:bg-blue-50"
                >
                  Detected: {detectedTimezone} ({getUtcOffset(detectedTimezone)})
                </button>
              </li>
            )}
            {grouped.map(([region, tzs]) => (
              <li key={region}>
                <div className="sticky top-0 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-400">
                  {region}
                </div>
                {tzs.map((tz) => (
                  <button
                    key={tz.value}
                    type="button"
                    onClick={() => {
                      onChange(tz.value);
                      setOpen(false);
                    }}
                    className={`w-full rounded px-3 py-1.5 text-left text-sm hover:bg-gray-100 ${
                      tz.value === value
                        ? "bg-gray-100 font-medium text-gray-900"
                        : "text-gray-700"
                    }`}
                  >
                    {tz.label}
                  </button>
                ))}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">
                No timezones found
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Settings() {
  const queryClient = useQueryClient();

  // ── User settings ──
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<User>("/api/settings"),
  });

  const [form, setForm] = useState({
    displayName: "",
    timezone: "",
    voiceStyle: "natural",
    voiceNotes: "",
    digestNotifyEmail: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        displayName: settings.displayName ?? "",
        timezone:
          settings.timezone ??
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        voiceStyle: settings.voiceStyle ?? "natural",
        voiceNotes: settings.voiceNotes ?? "",
        digestNotifyEmail: settings.digestNotifyEmail ?? false,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => api.put("/api/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  // ── Telegram linking ──
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string>("JournalizerAppBot");

  const linkTelegramMutation = useMutation({
    mutationFn: () =>
      api.post<{ code: string; botUsername: string }>("/api/settings/link-telegram", {}),
    onSuccess: (data) => {
      setLinkCode(data.code);
      setBotUsername(data.botUsername);
    },
    onError: () => toast.error("Failed to generate linking code"),
  });

  const unlinkTelegramMutation = useMutation({
    mutationFn: () => api.post("/api/settings/unlink-telegram", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setLinkCode(null);
      toast.success("Telegram unlinked");
    },
    onError: () => toast.error("Failed to unlink Telegram"),
  });

  // ── Personal Dictionary ──
  const { data: dictionaryData } = useQuery({
    queryKey: ["dictionary"],
    queryFn: () =>
      api.get<{ terms: DictionaryTerm[] }>("/api/settings/dictionary"),
  });

  const dictTerms = dictionaryData?.terms ?? [];

  const [newTerm, setNewTerm] = useState("");
  const [newTermCategory, setNewTermCategory] = useState("other");

  const addTermMutation = useMutation({
    mutationFn: (data: { term: string; category: string }) =>
      api.post("/api/settings/dictionary", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dictionary"] });
      setNewTerm("");
      toast.success("Term added");
    },
    onError: () => toast.error("Failed to add term"),
  });

  const deleteTermMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/settings/dictionary/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dictionary"] });
      toast.success("Term removed");
    },
    onError: () => toast.error("Failed to remove term"),
  });

  const extractMutation = useMutation({
    mutationFn: () =>
      api.post<{ entriesScanned: number; termsExtracted: number }>(
        "/api/settings/extract-dictionary",
        {}
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dictionary"] });
      toast.success(
        `Scanned ${data.entriesScanned} entries, extracted ${data.termsExtracted} terms`
      );
    },
    onError: () => toast.error("Failed to extract dictionary"),
  });

  // ── Reminders ──
  const { data: remindersData } = useQuery({
    queryKey: ["reminders"],
    queryFn: () =>
      api.get<{ reminders: Reminder[] }>("/api/reminders"),
  });

  const reminders = remindersData?.reminders ?? [];

  const [newReminder, setNewReminder] = useState({
    reminderType: "daily" as Reminder["reminderType"],
    timeOfDay: "09:00",
    dayOfWeek: 1,
    dayOfMonth: 1,
    smartThreshold: 3,
  });

  const createReminderMutation = useMutation({
    mutationFn: (data: typeof newReminder) =>
      api.post("/api/reminders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder created");
    },
    onError: () => toast.error("Failed to create reminder"),
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/reminders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      toast.success("Reminder deleted");
    },
    onError: () => toast.error("Failed to delete reminder"),
  });

  const toggleReminderMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/reminders/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: () => toast.error("Failed to update reminder"),
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

        {/* Profile & Voice Settings */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(form);
          }}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-6"
        >
          <h2 className="text-lg font-medium text-gray-900">Profile</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Display Name
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <TimezoneSelect
              value={form.timezone}
              onChange={(tz) => setForm({ ...form, timezone: tz })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Voice Style
            </label>
            <select
              value={form.voiceStyle}
              onChange={(e) =>
                setForm({ ...form, voiceStyle: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {voiceStyles.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Controls how AI polishes your journal entries
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Voice Notes
            </label>
            <textarea
              value={form.voiceNotes}
              onChange={(e) =>
                setForm({ ...form, voiceNotes: e.target.value })
              }
              rows={3}
              maxLength={500}
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Additional instructions for AI polishing"
            />
          </div>

          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </button>
        </form>

        {/* Telegram Linking */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            Telegram
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Link your Telegram to journal via messages and receive reminders.
          </p>
          {settings?.telegramLinked ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-green-600">
                Telegram linked
              </p>
              <button
                type="button"
                onClick={() => unlinkTelegramMutation.mutate()}
                disabled={unlinkTelegramMutation.isPending}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Unlink
              </button>
            </div>
          ) : linkCode ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Send this code to{" "}
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 hover:underline"
                >
                  @{botUsername}
                </a>{" "}
                on Telegram:
              </p>
              <div className="inline-block rounded-md bg-gray-100 px-4 py-2 font-mono text-lg font-bold tracking-widest text-gray-900">
                {linkCode}
              </div>
              <p className="text-xs text-gray-400">
                This code expires in 10 minutes.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => linkTelegramMutation.mutate()}
              disabled={linkTelegramMutation.isPending}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {linkTelegramMutation.isPending ? "Generating..." : "Link Telegram"}
            </button>
          )}
        </div>

        {/* Digest Notifications */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-medium text-gray-900">
            Digest Notifications
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Get notified when your daily entry is compiled.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Telegram</p>
                <p className="text-xs text-gray-400">
                  {settings?.telegramLinked
                    ? "Enabled automatically when Telegram is linked"
                    : "Link Telegram above to enable"}
                </p>
              </div>
              <span
                className={`text-sm ${
                  settings?.telegramLinked
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                {settings?.telegramLinked ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Email</p>
                <p className="text-xs text-gray-400">
                  Receive a fun recap at {settings?.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newVal = !form.digestNotifyEmail;
                  setForm({ ...form, digestNotifyEmail: newVal });
                  updateMutation.mutate({ digestNotifyEmail: newVal } as typeof form);
                }}
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  form.digestNotifyEmail ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.digestNotifyEmail
                      ? "translate-x-4"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Personal Dictionary */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-medium text-gray-900">
            Personal Dictionary
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            These words help improve transcription accuracy for voice entries.
          </p>

          {/* Existing terms as chips */}
          {dictTerms.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {dictTerms.map((t) => {
                const colors: Record<string, string> = {
                  person: "bg-blue-50 text-blue-700 border-blue-200",
                  place: "bg-green-50 text-green-700 border-green-200",
                  brand: "bg-purple-50 text-purple-700 border-purple-200",
                  pet: "bg-amber-50 text-amber-700 border-amber-200",
                  other: "bg-gray-50 text-gray-700 border-gray-200",
                };
                const colorClass = colors[t.category] || colors.other;
                return (
                  <span
                    key={t.id}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${colorClass}`}
                  >
                    {t.term}
                    <button
                      type="button"
                      onClick={() => deleteTermMutation.mutate(t.id)}
                      className="ml-0.5 text-current opacity-50 hover:opacity-100"
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Add new term */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="Add a name or word..."
              className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTerm.trim()) {
                  e.preventDefault();
                  addTermMutation.mutate({ term: newTerm.trim(), category: newTermCategory });
                }
              }}
            />
            <select
              value={newTermCategory}
              onChange={(e) => setNewTermCategory(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="person">Person</option>
              <option value="place">Place</option>
              <option value="brand">Brand</option>
              <option value="pet">Pet</option>
              <option value="other">Other</option>
            </select>
            <button
              type="button"
              onClick={() => {
                if (newTerm.trim()) {
                  addTermMutation.mutate({ term: newTerm.trim(), category: newTermCategory });
                }
              }}
              disabled={!newTerm.trim() || addTermMutation.isPending}
              className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {/* Auto-extract button */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {extractMutation.isPending
                ? "Extracting..."
                : "Auto-extract from entries"}
            </button>
            <p className="mt-1 text-xs text-gray-400">
              Scans your existing entries for names, places, and other proper nouns.
            </p>
          </div>
        </div>

        {/* Reminders */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            Reminders
          </h2>

          {/* Existing reminders */}
          {reminders.length > 0 && (
            <div className="mb-4 space-y-2">
              {reminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        toggleReminderMutation.mutate({
                          id: r.id,
                          isActive: !r.isActive,
                        })
                      }
                      className={`h-4 w-8 rounded-full transition-colors ${
                        r.isActive ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                          r.isActive
                            ? "translate-x-4"
                            : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <div className="text-sm">
                      <span className="font-medium capitalize text-gray-700">
                        {r.reminderType}
                      </span>
                      {r.timeOfDay && (
                        <span className="ml-2 text-gray-500">
                          at {r.timeOfDay}
                        </span>
                      )}
                      {r.reminderType === "weekly" &&
                        r.dayOfWeek !== null && (
                          <span className="ml-1 text-gray-500">
                            on {dayNames[r.dayOfWeek]}
                          </span>
                        )}
                      {r.reminderType === "monthly" &&
                        r.dayOfMonth !== null && (
                          <span className="ml-1 text-gray-500">
                            on the {r.dayOfMonth}
                            {r.dayOfMonth === 1
                              ? "st"
                              : r.dayOfMonth === 2
                                ? "nd"
                                : r.dayOfMonth === 3
                                  ? "rd"
                                  : "th"}
                          </span>
                        )}
                      {r.reminderType === "smart" &&
                        r.smartThreshold !== null && (
                          <span className="ml-1 text-gray-500">
                            after {r.smartThreshold} days
                          </span>
                        )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteReminderMutation.mutate(r.id)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New reminder form */}
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-600">Add Reminder</p>

            <div className="flex flex-wrap gap-2">
              <select
                value={newReminder.reminderType}
                onChange={(e) =>
                  setNewReminder({
                    ...newReminder,
                    reminderType: e.target
                      .value as Reminder["reminderType"],
                  })
                }
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="smart">Smart Nudge</option>
              </select>

              {newReminder.reminderType !== "smart" && (
                <input
                  type="time"
                  value={newReminder.timeOfDay}
                  onChange={(e) =>
                    setNewReminder({
                      ...newReminder,
                      timeOfDay: e.target.value,
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              )}

              {newReminder.reminderType === "weekly" && (
                <select
                  value={newReminder.dayOfWeek}
                  onChange={(e) =>
                    setNewReminder({
                      ...newReminder,
                      dayOfWeek: parseInt(e.target.value, 10),
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  {dayNames.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              )}

              {newReminder.reminderType === "monthly" && (
                <select
                  value={newReminder.dayOfMonth}
                  onChange={(e) =>
                    setNewReminder({
                      ...newReminder,
                      dayOfMonth: parseInt(e.target.value, 10),
                    })
                  }
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}

              {newReminder.reminderType === "smart" && (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">After</span>
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={newReminder.smartThreshold}
                    onChange={(e) =>
                      setNewReminder({
                        ...newReminder,
                        smartThreshold: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-gray-500">days</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => createReminderMutation.mutate(newReminder)}
                disabled={createReminderMutation.isPending}
                className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Email Reports */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-medium text-gray-900">
            Email Reports
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Receive a PDF of your journal entries on a recurring schedule.
          </p>
          <EmailSubscriptionForm />
        </div>

        {/* Export Data */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            Export Journal
          </h2>
          <ExportForm />
        </div>
      </main>
    </div>
  );
}
