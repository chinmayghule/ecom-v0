import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCategoryDto {
  // Trimmed so `@IsNotEmpty` rejects a whitespace-only name — the category
  // column is UNIQUE, and two sellers submitting `" "` would otherwise collide
  // on a name that displays as nothing.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
