// Glass verification proxy for frontend/src/pages/NewEntry.tsx
// Glass spec: glass/frontend/new-entry.glass

export class ValidationError extends Error {
  constructor(message = "Validation error") {
    super(message);
    this.name = "ValidationError";
  }
}

export class APIError extends Error {
  constructor(
    message = "API error",
    public status?: number
  ) {
    super(message);
    this.name = "APIError";
  }
}
