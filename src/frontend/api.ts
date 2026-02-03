// Glass verification proxy for frontend/src/lib/api.ts
// Glass spec: glass/frontend/api.glass

export class ApiError extends Error {
  constructor(
    message = "API error",
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}
