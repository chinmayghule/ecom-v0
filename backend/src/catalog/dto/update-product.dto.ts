import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

/**
 * `PartialType(CreateProductDto)`, written out.
 *
 * `@nestjs/mapped-types` is not a dependency of this project, and adding one to
 * save eight decorators is not a trade worth making. The cost of the hand-rolled
 * version is that the two classes can drift — so every field here must be
 * re-checked against `CreateProductDto` whenever that one changes.
 *
 * There is no `sellerId` here on purpose. Ownership is fixed at creation; letting
 * a seller reassign a listing would let them hand an unpublished draft to another
 * account and, in the other direction, give a hijacked session a way to push
 * fraudulent listings onto a third party's storefront.
 */
export class UpdateProductDto {
  @IsOptional()
  // Trimming makes `@IsNotEmpty` meaningful: without it, `name: "   "` passes
  // and silently renames the listing to nothing.
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isLive?: boolean;
}
