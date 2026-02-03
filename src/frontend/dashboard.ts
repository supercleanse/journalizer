// Glass verification proxy for frontend/src/pages/Dashboard.tsx
// Glass spec: glass/frontend/dashboard.glass

export class APIError extends Error {
  constructor(
    message = "API error",
    public status?: number
  ) {
    super(message);
    this.name = "APIError";
  }
}
