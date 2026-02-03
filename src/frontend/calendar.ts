// Glass verification proxy for frontend/src/components/Calendar.tsx
// Glass spec: glass/frontend/calendar.glass

export class RenderError extends Error {
  constructor(message = "Render error") {
    super(message);
    this.name = "RenderError";
  }
}
