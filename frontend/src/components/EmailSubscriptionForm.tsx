import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { EmailSubscription } from "../types";

type Period = "weekly" | "monthly" | "quarterly" | "yearly";

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const entryTypeLabels: Record<string, string> = {
  both: "All Entries",
  daily: "Daily Combined Entries",
  individual: "Individual Entries",
};

export default function EmailSubscriptionForm() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["emailSubscriptions"],
    queryFn: () =>
      api.get<{ subscriptions: EmailSubscription[] }>("/api/email/subscriptions"),
  });

  const subscriptions = data?.subscriptions ?? [];

  const [newSub, setNewSub] = useState({
    frequency: "weekly" as EmailSubscription["frequency"],
    entryTypes: "both" as EmailSubscription["entryTypes"],
    includeImages: true,
  });

  const createMutation = useMutation({
    mutationFn: (sub: typeof newSub) =>
      api.post("/api/email/subscriptions", sub),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailSubscriptions"] });
      toast.success("Email subscription created");
    },
    onError: () => toast.error("Failed to create subscription"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/email/subscriptions/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailSubscriptions"] });
    },
    onError: () => toast.error("Failed to update subscription"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/email/subscriptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailSubscriptions"] });
      toast.success("Subscription removed");
    },
    onError: () => toast.error("Failed to remove subscription"),
  });

  const [sendingPeriod, setSendingPeriod] = useState<Period | null>(null);
  const sendNowMutation = useMutation({
    mutationFn: (period: Period) =>
      api.post<{ success: boolean; entryCount?: number; message?: string }>(
        "/api/email/send-now",
        { period }
      ),
    onMutate: (period) => setSendingPeriod(period),
    onSuccess: (data) => {
      setSendingPeriod(null);
      if (data.success) {
        toast.success(`Email sent with ${data.entryCount} entries`);
      } else {
        toast.error(data.message || "No entries found");
      }
    },
    onError: () => {
      setSendingPeriod(null);
      toast.error("Failed to send email");
    },
  });

  return (
    <div>
      {/* Existing subscriptions */}
      {subscriptions.length > 0 && (
        <div className="mb-4 space-y-2">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    toggleMutation.mutate({
                      id: sub.id,
                      isActive: !sub.isActive,
                    })
                  }
                  className={`h-4 w-8 rounded-full transition-colors ${
                    sub.isActive ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                      sub.isActive ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <div className="text-sm">
                  <span className="font-medium text-gray-700">
                    {frequencyLabels[sub.frequency] || sub.frequency}
                  </span>
                  <span className="ml-2 text-gray-500">
                    {entryTypeLabels[sub.entryTypes] || sub.entryTypes}
                  </span>
                  {sub.includeImages === 1 && (
                    <span className="ml-2 text-gray-400">with images</span>
                  )}
                  {sub.nextEmailDate && (
                    <span className="ml-2 text-gray-400">
                      next: {sub.nextEmailDate}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(sub.id)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new subscription */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-gray-600">Add Subscription</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={newSub.frequency}
            onChange={(e) =>
              setNewSub({
                ...newSub,
                frequency: e.target.value as EmailSubscription["frequency"],
              })
            }
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>

          <select
            value={newSub.entryTypes}
            onChange={(e) =>
              setNewSub({
                ...newSub,
                entryTypes: e.target.value as EmailSubscription["entryTypes"],
              })
            }
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="both">All Entries</option>
            <option value="daily">Daily Combined Entries</option>
            <option value="individual">Individual Entries</option>
          </select>

          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={newSub.includeImages}
              onChange={(e) =>
                setNewSub({ ...newSub, includeImages: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            Images
          </label>

          <button
            type="button"
            onClick={() => createMutation.mutate(newSub)}
            disabled={createMutation.isPending}
            className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Send Now */}
      <div className="space-y-3 border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-gray-600">Send Now</p>
        <p className="text-xs text-gray-400">
          Send an immediate email with entries from the trailing period.
        </p>
        <div className="flex flex-wrap gap-2">
          {(["weekly", "monthly", "quarterly", "yearly"] as Period[]).map(
            (period) => (
              <button
                key={period}
                type="button"
                onClick={() => sendNowMutation.mutate(period)}
                disabled={sendNowMutation.isPending}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {sendingPeriod === period
                  ? "Sending..."
                  : `Last ${period === "weekly" ? "Week" : period === "monthly" ? "Month" : period === "quarterly" ? "Quarter" : "Year"}`}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
