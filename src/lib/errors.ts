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

  static badRequest(message: string, code = "BAD_REQUEST") {
    return new AppError(400, code, message);
  }

  static unauthorized(message = "Authentication required") {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "Access denied") {
    return new AppError(403, "FORBIDDEN", message);
  }

  static notFound(message = "Resource not found") {
    return new AppError(404, "NOT_FOUND", message);
  }

  static tooManyRequests(message = "Too many requests") {
    return new AppError(429, "RATE_LIMITED", message);
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
      err.statusCode as 400 | 401 | 403 | 404 | 429 | 500
    );
  }

  // Log full error in non-production
  const isProduction = c.env?.ENVIRONMENT === "production";
  if (!isProduction) {
    console.error(
      `[ERROR] ${c.req.method} ${c.req.path}:`,
      err.message,
      err.stack
    );
  } else {
    console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err.message);
  }

  return c.json(
    {
      error: {
        message: isProduction ? "Internal server error" : err.message,
        code: "INTERNAL_ERROR",
        status: 500,
      },
    },
    500
  );
}
