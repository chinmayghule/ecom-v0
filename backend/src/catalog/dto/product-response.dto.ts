import { InternalServerErrorException } from "@nestjs/common";
import type { Product } from "../../entities/product.entity.js";

/**
 * `products.price` is `numeric(10,2)`, and the `pg` driver hands every
 * `numeric` back as a **string** to avoid JavaScript's float rounding. The
 * entity declares `price!: number`, which is a lie the driver never honours —
 * TypeScript is satisfied at compile time and the client still receives
 * `"9.99"` where it expected `9.99`.
 *
 * That is not cosmetic. `product.price < 10` is `false` in JavaScript when
 * `price` is `"9.99"` because `"9.99" < 10` coerces via Number (true) but
 * `product.price * 1.1 === 10.989000000000001` arithmetic and any `===`
 * comparison against a numeric literal fails outright. Cart totals computed on
 * the client silently disagree with the server's.
 *
 * Every product leaves this module through `toProductResponse`, which is the
 * single conversion point.
 */
export function toPriceNumber(raw: number | string | null | undefined): number {
  const parsed =
    typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));

  if (!Number.isFinite(parsed)) {
    // The column is NOT NULL and numeric. A value that will not parse is a
    // database or mapping fault, and returning 0 would quietly reprice the
    // catalogue — better to fail loudly than to invent a price.
    throw new InternalServerErrorException(
      "Product price could not be read as a number",
    );
  }

  return parsed;
}

export class ProductResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  categoryId!: string | null;
  price!: number;
  imageUrl!: string | null;
  isLive!: boolean;
  sellerId!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class PaginatedProductsDto {
  items!: ProductResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

/**
 * Entity -> wire shape.
 *
 * Explicit field-by-field rather than `{ ...product }`: a spread would ship
 * `deletedAt`, and every future column added to the entity would silently start
 * appearing on the public API. The allow-list is the point.
 */
export function toProductResponse(product: Product): ProductResponseDto {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    categoryId: product.categoryId ?? null,
    price: toPriceNumber(product.price),
    imageUrl: product.imageUrl ?? null,
    isLive: product.isLive,
    sellerId: product.sellerId,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
