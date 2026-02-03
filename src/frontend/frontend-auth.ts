// Glass verification proxy for frontend/src/lib/auth.tsx
// Glass spec: glass/frontend/frontend-auth.glass

export class AuthCheckFailed extends Error {
  constructor(message = "Auth check failed") {
    super(message);
    this.name = "AuthCheckFailed";
  }
}
