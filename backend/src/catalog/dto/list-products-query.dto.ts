import { Type } from "class-transformer";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Query parameters for the public catalogue listing.
 *
 * Every numeric field carries `@Type(() => Number)`. Query strings arrive as
 * strings, and without the coercion `@IsInt()` rejects `"2"` with a 400 — the
 * one number a client always sends. The pipe runs with `transform: true`.
 *
 * Defaults are NOT applied here. `@Transform`/`plainToInstance` defaults would
 * only fire on the HTTP path, so a direct call to `CatalogService` (which the
 * integration suite makes, and any future in-process caller would) would see
 * `undefined` and divide by `undefined`. `CatalogService.listProducts` owns the
 * defaults so there is exactly one place that decides what "no page" means.
 */
export class ListProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;

  /**
   * Free-text name search. Whitespace is trimmed and an empty result is treated
   * as "no search" rather than as a LIKE against `%%`, which would return the
   * whole catalogue and look like the filter silently did nothing.
   */
  @IsOptional()
  @IsString()
  q?: string;
}
