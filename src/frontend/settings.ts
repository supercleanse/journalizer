// Glass verification proxy for frontend/src/pages/Settings.tsx
// Glass spec: glass/frontend/settings.glass

export class APIError extends Error {
  constructor(
    message = "API error",
    public status?: number
  ) {
    super(message);
    this.name = "APIError";
  }
}
