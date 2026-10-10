import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Same reasoning as `UpdateProductDto`: `@nestjs/mapped-types` is not a
 * dependency, so `PartialType` is written out.
 */
export class UpdateCategoryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
