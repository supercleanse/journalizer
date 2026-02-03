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

// ── Auth Errors ──────────────────────────────────────────────────────

export class InvalidState extends AppError {
  constructor(message = "Invalid or expired state parameter") {
    super(403, "INVALID_STATE", message);
    this.name = "InvalidState";
  }
}

export class TokenExchangeFailed extends AppError {
  constructor(message = "Failed to exchange authorization code") {
    super(502, "TOKEN_EXCHANGE_FAILED", message);
    this.name = "TokenExchangeFailed";
  }
}

export class UserCreationFailed extends AppError {
  constructor(message = "Failed to create user") {
    super(500, "USER_CREATION_FAILED", message);
    this.name = "UserCreationFailed";
  }
}

export class InvalidToken extends AppError {
  constructor(message = "Invalid or expired session") {
    super(401, "INVALID_TOKEN", message);
    this.name = "InvalidToken";
  }
}

export class MissingToken extends AppError {
  constructor(message = "Session required") {
    super(401, "MISSING_TOKEN", message);
    this.name = "MissingToken";
  }
}

// ── Database Errors ──────────────────────────────────────────────────

export class RecordNotFound extends AppError {
  constructor(message = "Record not found") {
    super(404, "RECORD_NOT_FOUND", message);
    this.name = "RecordNotFound";
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database error") {
    super(500, "DATABASE_ERROR", message);
    this.name = "DatabaseError";
  }
}

export class UniqueConstraintViolation extends AppError {
  constructor(message = "Unique constraint violation") {
    super(409, "UNIQUE_CONSTRAINT_VIOLATION", message);
    this.name = "UniqueConstraintViolation";
  }
}

export class ForeignKeyViolation extends AppError {
  constructor(message = "Foreign key violation") {
    super(409, "FOREIGN_KEY_VIOLATION", message);
    this.name = "ForeignKeyViolation";
  }
}

export class NotNullViolation extends AppError {
  constructor(message = "Required field is null") {
    super(400, "NOT_NULL_VIOLATION", message);
    this.name = "NotNullViolation";
  }
}

// ── Route / Index Errors ─────────────────────────────────────────────

export class RouteNotFound extends AppError {
  constructor(message = "Route not found") {
    super(404, "ROUTE_NOT_FOUND", message);
    this.name = "RouteNotFound";
  }
}

export class AuthenticationRequired extends AppError {
  constructor(message = "Authentication required") {
    super(401, "AUTHENTICATION_REQUIRED", message);
    this.name = "AuthenticationRequired";
  }
}

export class InternalError extends AppError {
  constructor(message = "Internal server error") {
    super(500, "INTERNAL_ERROR", message);
    this.name = "InternalError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(400, "VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
}

export class EntryNotFound extends AppError {
  constructor(message = "Entry not found") {
    super(404, "ENTRY_NOT_FOUND", message);
    this.name = "EntryNotFound";
  }
}

export class AIPolishFailed extends AppError {
  constructor(message = "AI polish failed") {
    super(500, "AI_POLISH_FAILED", message);
    this.name = "AIPolishFailed";
  }
}

export class ReminderNotFound extends AppError {
  constructor(message = "Reminder not found") {
    super(404, "REMINDER_NOT_FOUND", message);
    this.name = "ReminderNotFound";
  }
}

// ── Service Errors ───────────────────────────────────────────────────

export class ApiError extends AppError {
  constructor(message = "API error") {
    super(502, "API_ERROR", message);
    this.name = "ApiError";
  }
}

export class RateLimited extends AppError {
  constructor(message = "Rate limited") {
    super(429, "RATE_LIMITED", message);
    this.name = "RateLimited";
  }
}

export class InvalidResponse extends AppError {
  constructor(message = "Invalid response") {
    super(502, "INVALID_RESPONSE", message);
    this.name = "InvalidResponse";
  }
}

export class UploadFailed extends AppError {
  constructor(message = "Upload failed") {
    super(500, "UPLOAD_FAILED", message);
    this.name = "UploadFailed";
  }
}

export class MetadataInsertFailed extends AppError {
  constructor(message = "Failed to create media record") {
    super(500, "METADATA_INSERT_FAILED", message);
    this.name = "MetadataInsertFailed";
  }
}

export class MediaNotFound extends AppError {
  constructor(message = "Media not found") {
    super(404, "MEDIA_NOT_FOUND", message);
    this.name = "MediaNotFound";
  }
}

export class DownloadFailed extends AppError {
  constructor(message = "Download failed") {
    super(502, "DOWNLOAD_FAILED", message);
    this.name = "DownloadFailed";
  }
}

export class SMSDeliveryFailed extends AppError {
  constructor(message = "SMS delivery failed") {
    super(502, "SMS_DELIVERY_FAILED", message);
    this.name = "SMSDeliveryFailed";
  }
}

export class UserNotFound extends AppError {
  constructor(message = "User not found") {
    super(404, "USER_NOT_FOUND", message);
    this.name = "UserNotFound";
  }
}

export class TimezoneInvalid extends AppError {
  constructor(message = "Invalid timezone") {
    super(400, "TIMEZONE_INVALID", message);
    this.name = "TimezoneInvalid";
  }
}

export class TwilioAPIError extends AppError {
  constructor(message = "Twilio API error") {
    super(502, "TWILIO_API_ERROR", message);
    this.name = "TwilioAPIError";
  }
}

export class InvalidSignature extends AppError {
  constructor(message = "Invalid webhook signature") {
    super(403, "INVALID_SIGNATURE", message);
    this.name = "InvalidSignature";
  }
}

export class R2ObjectNotFound extends AppError {
  constructor(message = "R2 object not found") {
    super(404, "R2_OBJECT_NOT_FOUND", message);
    this.name = "R2ObjectNotFound";
  }
}

export class EmptyTranscript extends AppError {
  constructor(message = "No transcript returned") {
    super(422, "EMPTY_TRANSCRIPT", message);
    this.name = "EmptyTranscript";
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
