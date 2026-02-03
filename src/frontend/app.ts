// Glass verification proxy for frontend/src/App.tsx
// Glass spec: glass/frontend/app.glass

export class AuthenticationRequired extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationRequired";
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
