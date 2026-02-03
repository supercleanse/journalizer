import { describe, it, expect } from "vitest";
import { AppError } from "../src/lib/errors";

describe("AppError", () => {
  it("creates error with status code, code, and message", () => {
    const err = new AppError(400, "BAD_REQUEST", "Invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid input");
    expect(err.name).toBe("AppError");
    expect(err).toBeInstanceOf(Error);
  });

  describe("static factory methods", () => {
    it("badRequest creates 400 error", () => {
      const err = AppError.badRequest("missing field");
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toBe("missing field");
    });

    it("badRequest accepts custom code", () => {
      const err = AppError.badRequest("invalid", "VALIDATION_ERROR");
      expect(err.code).toBe("VALIDATION_ERROR");
    });

    it("unauthorized creates 401 error", () => {
      const err = AppError.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
    });

    it("forbidden creates 403 error", () => {
      const err = AppError.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });

    it("notFound creates 404 error", () => {
      const err = AppError.notFound("Entry not found");
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Entry not found");
    });

    it("tooManyRequests creates 429 error", () => {
      const err = AppError.tooManyRequests();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe("RATE_LIMITED");
    });
  });
});
