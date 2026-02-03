import type { Context } from "hono";
import type { AppContext } from "../types/env";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(err: Error, c: Context<AppContext, string>) {
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          message: err.message,
          code: err.code,
          status: err.statusCode,
        },
      },
      err.statusCode as 400 | 401 | 403 | 404 | 500
    );
  }

  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);

  return c.json(
    {
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
        status: 500,
      },
    },
    500
  );
}
