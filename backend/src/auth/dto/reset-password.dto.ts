import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";
import { IsStrongPassword } from "../validators/is-strong-password.validator.js";

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsStrongPassword()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
