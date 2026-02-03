import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import Header from "../components/Header";
import { api } from "../lib/api";
import type { User } from "../types";

const voiceStyles = [
  { value: "natural", label: "Natural" },
  { value: "conversational", label: "Conversational" },
  { value: "reflective", label: "Reflective" },
  { value: "polished", label: "Polished" },
];

export default function Settings() {
  const queryClient = useQueryClient();

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
        timezone: settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
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

  // Phone verification
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-6 text-xl font-semibold text-gray-900">Settings</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate(form);
          }}
          className="space-y-6 rounded-lg border border-gray-200 bg-white p-6"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Display Name
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
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
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
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
              onChange={(e) => setForm({ ...form, voiceStyle: e.target.value })}
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
              onChange={(e) => setForm({ ...form, voiceNotes: e.target.value })}
              rows={3}
              maxLength={500}
              className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Additional instructions for AI polishing, e.g. 'Use a warm, casual tone'"
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
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">
            Phone Verification
          </h2>
          {settings?.phoneVerified ? (
            <p className="text-sm text-green-600">
              Phone verified: {settings.phoneNumber}
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
                onClick={() => confirmMutation.mutate()}
                disabled={verifyCode.length !== 6 || confirmMutation.isPending}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                Verify
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
