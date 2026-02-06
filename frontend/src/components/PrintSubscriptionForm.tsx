import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import type { PrintSubscription, PrintOrder } from "../types";

type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const FREQUENCY_PRICES: Record<Frequency, string> = {
  weekly: "$12.99",
  monthly: "$17.99",
  quarterly: "$24.99",
  yearly: "$39.99",
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  generating: { label: "Generating", className: "bg-blue-100 text-blue-800" },
  uploaded: { label: "Processing", className: "bg-blue-100 text-blue-800" },
  in_production: { label: "Printing", className: "bg-purple-100 text-purple-800" },
  shipped: { label: "Shipped", className: "bg-green-100 text-green-800" },
  delivered: { label: "Delivered", className: "bg-green-200 text-green-900" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  payment_failed: { label: "Payment Failed", className: "bg-red-100 text-red-800" },
};

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}

export default function PrintSubscriptionForm() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    frequency: "monthly" as Frequency,
    shippingName: "",
    shippingLine1: "",
    shippingLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingZip: "",
    shippingCountry: "US",
    colorOption: "bw",
    includeImages: true,
  });

  // Fetch subscriptions
  const { data: subsData } = useQuery({
    queryKey: ["printSubscriptions"],
    queryFn: () =>
      api.get<{ subscriptions: PrintSubscription[] }>("/api/print/subscriptions"),
  });

  // Fetch orders
  const { data: ordersData } = useQuery({
    queryKey: ["printOrders"],
    queryFn: () =>
      api.get<{ orders: PrintOrder[] }>("/api/print/orders"),
  });

  const subscriptions = subsData?.subscriptions ?? [];
  const orders = ordersData?.orders ?? [];

  // Create subscription
  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/api/print/subscriptions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printSubscriptions"] });
      toast.success("Print subscription created");
      setShowForm(false);
      setForm({
        frequency: "monthly",
        shippingName: "",
        shippingLine1: "",
        shippingLine2: "",
        shippingCity: "",
        shippingState: "",
        shippingZip: "",
        shippingCountry: "US",
        colorOption: "bw",
        includeImages: true,
      });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to create subscription"),
  });

  // Toggle subscription
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/print/subscriptions/${id}`, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printSubscriptions"] });
    },
    onError: () => toast.error("Failed to update subscription"),
  });

  // Delete subscription
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/print/subscriptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printSubscriptions"] });
      toast.success("Subscription cancelled");
    },
    onError: () => toast.error("Failed to cancel subscription"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <div className="space-y-4">
      {/* Existing Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="space-y-2">
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
                      isActive: sub.isActive === 1 ? false : true,
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
                    {FREQUENCY_LABELS[sub.frequency as Frequency] ?? sub.frequency}
                  </span>
                  <span className="ml-2 text-gray-500">
                    {sub.colorOption === "color" ? "Color" : "B&W"}
                  </span>
                  <span className="ml-2 text-gray-400">
                    {FREQUENCY_PRICES[sub.frequency as Frequency] ?? ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sub.nextPrintDate && sub.isActive ? (
                  <span className="text-xs text-gray-400">
                    Next: {formatDate(sub.nextPrintDate)}
                  </span>
                ) : null}
                <button
                  onClick={() => deleteMutation.mutate(sub.id)}
                  className="text-xs text-gray-400 hover:text-red-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Subscription Form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-gray-100 pt-4">
          {/* Frequency */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Frequency
            </label>
            <div className="flex gap-3">
              {(["weekly", "monthly", "quarterly", "yearly"] as const).map((f) => (
                <label key={f} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="frequency"
                    value={f}
                    checked={form.frequency === f}
                    onChange={() => setForm({ ...form, frequency: f })}
                    className="text-gray-900 focus:ring-gray-500"
                  />
                  <span className="text-sm text-gray-700">
                    {FREQUENCY_LABELS[f]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {FREQUENCY_PRICES[f]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Shipping Address */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Shipping Address
            </label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Full Name"
                value={form.shippingName}
                onChange={(e) => setForm({ ...form, shippingName: e.target.value })}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Address Line 1"
                value={form.shippingLine1}
                onChange={(e) => setForm({ ...form, shippingLine1: e.target.value })}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Address Line 2 (optional)"
                value={form.shippingLine2}
                onChange={(e) => setForm({ ...form, shippingLine2: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={form.shippingCity}
                  onChange={(e) => setForm({ ...form, shippingCity: e.target.value })}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={form.shippingState}
                  onChange={(e) => setForm({ ...form, shippingState: e.target.value })}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={form.shippingZip}
                  onChange={(e) => setForm({ ...form, shippingZip: e.target.value })}
                  required
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.colorOption === "color"}
                onChange={(e) =>
                  setForm({ ...form, colorOption: e.target.checked ? "color" : "bw" })
                }
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">Color printing (adds $5-15)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.includeImages}
                onChange={(e) =>
                  setForm({ ...form, includeImages: e.target.checked })
                }
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">Include images</span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Start Subscription"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Add Print Subscription
        </button>
      )}

      {/* Order History */}
      {orders.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <h3 className="mb-2 text-sm font-medium text-gray-600">
            Order History
          </h3>
          <div className="space-y-2">
            {orders.slice(0, 10).map((order) => {
              const badge = STATUS_BADGES[order.status] ?? {
                label: order.status,
                className: "bg-gray-100 text-gray-800",
              };
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-medium capitalize text-gray-700">
                      {order.frequency}
                    </span>
                    <span className="ml-2 text-gray-500">
                      {formatDate(order.periodStart)} - {formatDate(order.periodEnd)}
                    </span>
                    {order.pageCount && (
                      <span className="ml-2 text-gray-400">
                        {order.pageCount} pages
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {order.retailCents && (
                      <span className="text-xs text-gray-500">
                        ${(order.retailCents / 100).toFixed(2)}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Track
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pricing info */}
      <p className="text-xs text-gray-400">
        Printed journals are shipped directly to your address. Prices include printing and standard shipping.
      </p>
    </div>
  );
}
