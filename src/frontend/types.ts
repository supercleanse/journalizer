// Glass verification proxy for frontend/src/types/index.ts
// Glass spec: glass/frontend/types.glass

export class TypeMismatch extends Error {
  constructor(message = "Type mismatch") {
    super(message);
    this.name = "TypeMismatch";
  }
}
