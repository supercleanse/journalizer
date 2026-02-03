import { useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";
import Header from "../components/Header";
import { api } from "../lib/api";
import type { User, Reminder } from "../types";

const voiceStyles = [
  { value: "natural", label: "Natural" },
  { value: "conversational", label: "Conversational" },
  { value: "reflective", label: "Reflective" },
  { value: "polished", label: "Polished" },
];

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

  // ── Phone verification ──
  const [phone, setPhone] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const sendCodeMutation = useMutation({
    mutationFn: () =>
      api.post("/api/settings/verify-phone", { phoneNumber: phone }),
    onSuccess: () => {
      setCodeSent(true);
      toast.success("Verification code sent");
    },
    onError: () => toast.error("Failed to send code"),
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.post("/api/settings/confirm-phone", { code: verifyCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setCodeSent(false);
      setPhone("");
      setVerifyCode("");
      toast.success("Phone verified");
    },
    onError: () => toast.error("Invalid code"),
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
            <input
              type="text"
              value={form.timezone}
              onChange={(e) =>
                setForm({ ...form, timezone: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="America/New_York"
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

        {/* Phone Verification */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            Phone Verification
          </h2>
          <p className="mb-3 text-sm text-gray-500">
            Verify your phone to journal via SMS and receive reminders.
          </p>
          {settings?.phoneVerified ? (
            <p className="text-sm text-green-600">
              Verified: {settings.phoneNumber}
            </p>
          ) : !codeSent ? (
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+15551234567"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => sendCodeMutation.mutate()}
                disabled={!phone || sendCodeMutation.isPending}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Send Code
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => confirmMutation.mutate()}
                disabled={
                  verifyCode.length !== 6 || confirmMutation.isPending
                }
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          )}
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
      </main>
    </div>
  );
}
