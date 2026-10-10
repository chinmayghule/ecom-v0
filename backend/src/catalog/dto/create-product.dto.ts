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

export class CreateProductDto {
  /**
   * Trimmed before validation, so a whitespace-only name fails `@IsNotEmpty`
   * instead of storing a listing whose name renders as nothing at all.
   */
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * The category is a foreign key, not a client-chosen scalar: `products.categoryId`
   * is declared with `@RelationId`, which TypeORM treats as derived from the
   * `category` join column rather than as a column a client may write directly.
   * The service maps this onto the relation (see `CatalogService.updateProduct`).
   */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /**
   * `decimal(10,2)` on the PostgreSQL side. `@IsNumber` rather than `@IsInt`
   * because the column carries cents — an integer check would reject every
   * price that is not a whole currency unit.
   */
  // Deliberately NOT `@Type(() => Number)`. That would accept a JSON string
  // `"249.99"`, but it coerces `""` to `0` as well — so an empty or malformed
  // price would become a free product rather than a 400. Rejecting the string
  // outright is the safer failure: the client gets a clear error instead of a
  // listing priced at zero.
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /**
   * Sellers need to save a draft without publishing it, so this is settable at
   * creation. It is a *visibility* flag, not a permission: `ProductPolicy` still
   * decides who may see the draft.
   */
  @IsOptional()
  @IsBoolean()
  isLive?: boolean;
}
