// Glass verification proxy for frontend/src/pages/EntryView.tsx
// Glass spec: glass/frontend/entry-view.glass

export class EntryNotFound extends Error {
  constructor(message = "Entry not found") {
    super(message);
    this.name = "EntryNotFound";
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
