import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { RegisterDto } from "../dto/register.dto.js";

describe("RegisterDto", () => {
  it("passes for valid input", async () => {
    const dto = new RegisterDto();
    dto.email = "test@example.com";
    dto.password = "kX9#mP2$vL7@nR5!";
    dto.name = "Test User";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("passes without optional name", async () => {
    const dto = new RegisterDto();
    dto.email = "test@example.com";
    dto.password = "kX9#mP2$vL7@nR5!";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects invalid email", async () => {
    const dto = new RegisterDto();
    dto.email = "not-an-email";
    dto.password = "kX9#mP2$vL7@nR5!";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("email");
  });

  it("rejects short password (< 8 chars)", async () => {
    const dto = new RegisterDto();
    dto.email = "test@example.com";
    dto.password = "1234567";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("password");
  });

  it("rejects long password (> 128 chars)", async () => {
    const dto = new RegisterDto();
    dto.email = "test@example.com";
    dto.password = "a".repeat(129);

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("password");
  });

  it("rejects long email (> 255 chars)", async () => {
    const dto = new RegisterDto();
    dto.email = `${"a".repeat(250)}@b.com`;
    dto.password = "kX9#mP2$vL7@nR5!";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("email");
  });

  it("rejects missing email", async () => {
    const dto = new RegisterDto();
    dto.password = "kX9#mP2$vL7@nR5!";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "email")).toBe(true);
  });

  it("rejects missing password", async () => {
    const dto = new RegisterDto();
    dto.email = "test@example.com";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.some((e) => e.property === "password")).toBe(true);
  });
});
