import { describe, it, expect } from "vitest";
import { determineRole } from "../src/routes/auth";

describe("determineRole", () => {
  it("returns 'user' when ADMIN_EMAILS is undefined", () => {
    expect(determineRole("foo@bar.com", undefined)).toBe("user");
  });

  it("returns 'user' when ADMIN_EMAILS is empty string", () => {
    expect(determineRole("foo@bar.com", "")).toBe("user");
  });

  it("returns 'admin' when email matches single ADMIN_EMAILS", () => {
    expect(determineRole("admin@example.com", "admin@example.com")).toBe(
      "admin"
    );
  });

  it("returns 'admin' when email matches one of multiple ADMIN_EMAILS", () => {
    expect(
      determineRole("admin@example.com", "other@test.com, admin@example.com")
    ).toBe("admin");
  });

  it("returns 'user' when email does not match ADMIN_EMAILS", () => {
    expect(determineRole("user@example.com", "admin@example.com")).toBe("user");
  });

  it("is case-insensitive", () => {
    expect(determineRole("Admin@Example.COM", "admin@example.com")).toBe(
      "admin"
    );
  });

  it("handles whitespace in ADMIN_EMAILS", () => {
    expect(
      determineRole("b@b.com", "  a@a.com , b@b.com , c@c.com  ")
    ).toBe("admin");
  });
});
