// Glass verification proxy for frontend/src/components/EntryCard.tsx
// Glass spec: glass/frontend/entry-card.glass

export class RenderError extends Error {
  constructor(message = "Render error") {
    super(message);
    this.name = "RenderError";
  }
}
