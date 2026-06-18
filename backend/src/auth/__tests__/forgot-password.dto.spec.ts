import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { ForgotPasswordDto } from "../dto/forgot-password.dto.js";

describe("ForgotPasswordDto", () => {
  it("passes for valid email", async () => {
    const dto = new ForgotPasswordDto();
    dto.email = "test@example.com";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid email", async () => {
    const dto = new ForgotPasswordDto();
    dto.email = "not-an-email";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("email");
  });

  it("rejects empty email", async () => {
    const dto = new ForgotPasswordDto();
    dto.email = "";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("rejects missing email", async () => {
    const dto = new ForgotPasswordDto();

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });
});
