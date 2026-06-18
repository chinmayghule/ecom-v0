import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { ResetPasswordDto } from "../dto/reset-password.dto.js";

describe("ResetPasswordDto", () => {
  it("passes for valid input", async () => {
    const dto = new ResetPasswordDto();
    dto.token = "valid-token-123";
    dto.password = "newPassword123!";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects short password (< 8 chars)", async () => {
    const dto = new ResetPasswordDto();
    dto.token = "token";
    dto.password = "1234567";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("password");
  });

  it("rejects long password (> 128 chars)", async () => {
    const dto = new ResetPasswordDto();
    dto.token = "token";
    dto.password = "a".repeat(129);

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("password");
  });

  it("rejects empty token", async () => {
    const dto = new ResetPasswordDto();
    dto.token = "";
    dto.password = "newPassword123!";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "token")).toBe(true);
  });

  it("rejects missing token", async () => {
    const dto = new ResetPasswordDto();
    dto.password = "newPassword123!";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "token")).toBe(true);
  });

  it("rejects missing password", async () => {
    const dto = new ResetPasswordDto();
    dto.token = "valid-token";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });

  it("rejects empty password", async () => {
    const dto = new ResetPasswordDto();
    dto.token = "valid-token";
    dto.password = "";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });
});
