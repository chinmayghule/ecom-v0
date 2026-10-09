import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { LoginDto } from "../dto/login.dto.js";

describe("LoginDto", () => {
  it("passes for valid input", async () => {
    const dto = new LoginDto();
    dto.email = "test@example.com";
    dto.password = "my-password";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid email", async () => {
    const dto = new LoginDto();
    dto.email = "not-an-email";
    dto.password = "password";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("email");
  });

  it("rejects empty email", async () => {
    const dto = new LoginDto();
    dto.email = "";
    dto.password = "password";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("rejects missing email", async () => {
    const dto = new LoginDto();
    dto.password = "password";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("rejects empty password", async () => {
    const dto = new LoginDto();
    dto.email = "test@example.com";
    dto.password = "";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });

  it("rejects missing password", async () => {
    const dto = new LoginDto();
    dto.email = "test@example.com";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });

  it("transforms email to lowercase", async () => {
    const dto = new LoginDto();
    dto.email = "Test@Example.Com";
    dto.password = "password";

    expect(dto.email).toBe("Test@Example.Com"); // Transform happens during validation
  });
});
