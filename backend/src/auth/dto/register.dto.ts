import { Transform } from "class-transformer";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { IsStrongPassword } from "../validators/is-strong-password.validator.js";

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.toLowerCase() : value,
  )
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsStrongPassword()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}
