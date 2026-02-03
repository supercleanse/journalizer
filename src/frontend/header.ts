// Glass verification proxy for frontend/src/components/Header.tsx
// Glass spec: glass/frontend/header.glass

export class LogoutFailed extends Error {
  constructor(message = "Logout failed") {
    super(message);
    this.name = "LogoutFailed";
  }
}
