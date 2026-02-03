// Glass verification proxy for frontend/src/lib/hooks.ts
// Glass spec: glass/frontend/hooks.glass

export class CleanupError extends Error {
  constructor(message = "Cleanup error") {
    super(message);
    this.name = "CleanupError";
  }
}
