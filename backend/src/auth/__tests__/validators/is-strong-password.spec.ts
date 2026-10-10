import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { IsStrongPassword } from "../../validators/is-strong-password.validator.js";

class TestDto {
  @IsStrongPassword()
  password!: string;
}

describe("IsStrongPassword", () => {
  it("passes for a strong password with mixed characters", async () => {
    const dto = new TestDto();
    dto.password = "Correct-Horse-Battery-Staple-2024!";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("passes for a complex password with symbols and numbers", async () => {
    const dto = new TestDto();
    dto.password = "kX9#mP2$vL7@nR5!";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects 'password' (very weak)", async () => {
    const dto = new TestDto();
    dto.password = "password";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("password");
  });

  it("rejects '12345678' (very weak)", async () => {
    const dto = new TestDto();
    dto.password = "12345678";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("password");
  });

  it("rejects empty string", async () => {
    const dto = new TestDto();
    dto.password = "";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it("rejects 'qwertyuiop' (keyboard pattern)", async () => {
    const dto = new TestDto();
    dto.password = "qwertyuiop";

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("password");
  });

  it("passes for a long random password", async () => {
    const dto = new TestDto();
    dto.password = "my-dog-ate-my-homework-again-in-2024!";

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
