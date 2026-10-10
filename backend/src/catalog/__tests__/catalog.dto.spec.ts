// `@Type` stores its target on the prototype through `Reflect.defineMetadata`,
// which does not exist until the polyfill is loaded. `main.ts` imports it at
// boot; a standalone spec file has to do it itself.
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CreateCategoryDto } from "../dto/create-category.dto.js";
import { CreateProductDto } from "../dto/create-product.dto.js";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  ListProductsQueryDto,
} from "../dto/list-products-query.dto.js";
import { UpdateCategoryDto } from "../dto/update-category.dto.js";
import { UpdateProductDto } from "../dto/update-product.dto.js";

/**
 * The `ValidationPipe` configured in `main.ts` runs with `transform: true`, so
 * the coercion `@Type(() => Number)` performs is part of the contract, not an
 * optimisation. These tests drive `plainToInstance` to reproduce it.
 */
const parse = <T extends object>(
  cls: new () => T,
  raw: Record<string, unknown>,
): T => plainToInstance(cls, raw, { enableImplicitConversion: false });

/**
 * The exact options `main.ts` configures. Reproduced rather than assumed:
 * `plainToInstance` on its own copies every key across, and it is
 * `whitelist: true` that strips the undecorated ones — so a test that skipped
 * these options would "prove" nothing about what the endpoint actually accepts.
 */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

const errorsFor = async <T extends object>(
  cls: new () => T,
  raw: Record<string, unknown>,
): Promise<string[]> => {
  const errors = await validate(parse(cls, raw), PIPE_OPTIONS);
  return errors.map((e) => e.property);
};

describe("ListProductsQueryDto", () => {
  it("accepts an empty query", async () => {
    expect(await errorsFor(ListProductsQueryDto, {})).toHaveLength(0);
  });

  it("coerces numeric strings, because a query string is never a number", async () => {
    const dto = parse(ListProductsQueryDto, {
      page: "2",
      limit: "50",
      minPrice: "9.99",
      maxPrice: "100",
    });

    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.minPrice).toBe(9.99);
    expect(dto.maxPrice).toBe(100);
    expect(await errorsFor(ListProductsQueryDto, { page: "2" })).toHaveLength(
      0,
    );
  });

  it("rejects a page below 1", async () => {
    expect(await errorsFor(ListProductsQueryDto, { page: "0" })).toContain(
      "page",
    );
  });

  it("rejects a non-integer page", async () => {
    expect(await errorsFor(ListProductsQueryDto, { page: "1.5" })).toContain(
      "page",
    );
  });

  it("rejects a limit above 100", async () => {
    expect(await errorsFor(ListProductsQueryDto, { limit: "101" })).toContain(
      "limit",
    );
  });

  it("rejects a limit of zero", async () => {
    expect(await errorsFor(ListProductsQueryDto, { limit: "0" })).toContain(
      "limit",
    );
  });

  it("rejects a negative price", async () => {
    const errors = await errorsFor(ListProductsQueryDto, {
      minPrice: "-1",
    });
    expect(errors).toContain("minPrice");
  });

  it("rejects a malformed uuid", async () => {
    expect(
      await errorsFor(ListProductsQueryDto, { categoryId: "not-a-uuid" }),
    ).toContain("categoryId");
  });

  it("publishes its defaults so the service and the docs agree", () => {
    // The DTO deliberately does not apply them — `CatalogService` owns the
    // defaulting so direct callers see the same numbers as HTTP callers.
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_LIMIT).toBe(20);
  });

  it("has no defaults applied by the transform itself", () => {
    const dto = parse(ListProductsQueryDto, {});
    expect(dto.page).toBeUndefined();
    expect(dto.limit).toBeUndefined();
  });
});

describe("CreateProductDto", () => {
  it("accepts the minimum viable product", async () => {
    expect(
      await errorsFor(CreateProductDto, { name: "Widget", price: 9.99 }),
    ).toHaveLength(0);
  });

  it("requires a name", async () => {
    expect(await errorsFor(CreateProductDto, { price: 1 })).toContain("name");
  });

  it("rejects a blank name", async () => {
    expect(await errorsFor(CreateProductDto, { name: "", price: 1 })).toContain(
      "name",
    );
  });

  it("requires a price", async () => {
    expect(await errorsFor(CreateProductDto, { name: "Widget" })).toContain(
      "price",
    );
  });

  it("rejects a negative price", async () => {
    expect(
      await errorsFor(CreateProductDto, { name: "Widget", price: -1 }),
    ).toContain("price");
  });

  it("rejects more precision than the column can hold", async () => {
    // numeric(10,2) would silently round; rejecting is better than storing a
    // price the seller did not type.
    expect(
      await errorsFor(CreateProductDto, { name: "Widget", price: 1.005 }),
    ).toContain("price");
  });

  it("rejects a non-numeric price", async () => {
    expect(
      await errorsFor(CreateProductDto, { name: "Widget", price: "free" }),
    ).toContain("price");
  });

  it("rejects a non-uuid categoryId", async () => {
    expect(
      await errorsFor(CreateProductDto, {
        name: "Widget",
        price: 1,
        categoryId: "abc",
      }),
    ).toContain("categoryId");
  });
});

describe("UpdateProductDto", () => {
  it("accepts an empty patch", async () => {
    expect(await errorsFor(UpdateProductDto, {})).toHaveLength(0);
  });

  it("rejects an empty name rather than blanking the listing", async () => {
    expect(await errorsFor(UpdateProductDto, { name: "" })).toContain("name");
  });

  it("rejects a whitespace-only name", async () => {
    expect(await errorsFor(UpdateProductDto, { name: "   " })).toContain(
      "name",
    );
  });

  it("trims the name before it is stored", () => {
    expect(parse(UpdateProductDto, { name: "  Widget  " }).name).toBe("Widget");
  });

  it("rejects a negative price", async () => {
    expect(await errorsFor(UpdateProductDto, { price: -1 })).toContain("price");
  });

  it("has no sellerId, so ownership cannot be reassigned by a client", async () => {
    // Rejected outright by `forbidNonWhitelisted`, not quietly ignored: a
    // client that believes it moved a listing must be told it did not.
    expect(
      await errorsFor(UpdateProductDto, { sellerId: "someone-else" }),
    ).toContain("sellerId");
  });
});

describe("CreateCategoryDto", () => {
  it("requires a name", async () => {
    expect(await errorsFor(CreateCategoryDto, {})).toContain("name");
  });

  it("accepts a name with an optional description", async () => {
    expect(
      await errorsFor(CreateCategoryDto, { name: "Tools", description: "x" }),
    ).toHaveLength(0);
  });

  it("rejects a whitespace-only name", async () => {
    // Without the `@Transform` trim, `@IsNotEmpty` sees a non-empty string of
    // spaces and stores a category whose name displays as nothing.
    expect(await errorsFor(CreateCategoryDto, { name: "   " })).toContain(
      "name",
    );
  });
});

describe("UpdateCategoryDto", () => {
  it("accepts an empty patch", async () => {
    expect(await errorsFor(UpdateCategoryDto, {})).toHaveLength(0);
  });

  it("rejects a blank name", async () => {
    expect(await errorsFor(UpdateCategoryDto, { name: " " })).toContain("name");
  });
});
