import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CreateCategoryDto } from "../dto/create-category.dto.js";
import { CreateProductDto } from "../dto/create-product.dto.js";
import { ListProductsQueryDto } from "../dto/list-products-query.dto.js";

/**
 * DTO validation, run through the same `class-transformer` → `class-validator`
 * pipeline the global `ValidationPipe` uses.
 *
 * These carry more weight than a typical DTO test because two of the fields are
 * deliberately unusual: names are trimmed rather than rejected, and price is
 * *not* coerced from a string. Both are asserted here so the reasoning survives
 * the next person who "fixes" them.
 */
describe("catalog DTOs", () => {
  const validateDto = async <T extends object>(
    cls: new () => T,
    plain: Record<string, unknown>,
  ) => validate(plainToInstance(cls, plain));

  describe("CreateProductDto", () => {
    const valid = { name: "Vintage Chair", price: 249.99 };

    it("accepts a well-formed product", async () => {
      expect(await validateDto(CreateProductDto, valid)).toHaveLength(0);
    });

    it("trims surrounding whitespace from the name", async () => {
      // A name of "   " passes `@IsNotEmpty` — which only rejects the empty
      // string — so without this it would store a listing whose title renders
      // as nothing.
      const dto = plainToInstance(CreateProductDto, {
        ...valid,
        name: "  Vintage Chair  ",
      });
      await validate(dto);
      expect(dto.name).toBe("Vintage Chair");
    });

    it("rejects a whitespace-only name", async () => {
      const errors = await validateDto(CreateProductDto, {
        ...valid,
        name: "   ",
      });
      expect(errors.map((e) => e.property)).toContain("name");
    });

    it("rejects a negative price", async () => {
      const errors = await validateDto(CreateProductDto, {
        ...valid,
        price: -1,
      });
      expect(errors.map((e) => e.property)).toContain("price");
    });

    it("rejects a string price rather than coercing it", async () => {
      // Not `@Type(() => Number)`: that would turn `""` into 0 and list a
      // product for free. A 400 is the better answer.
      const errors = await validateDto(CreateProductDto, {
        ...valid,
        price: "249.99",
      });
      expect(errors.map((e) => e.property)).toContain("price");
    });

    it("rejects more than two decimal places", async () => {
      const errors = await validateDto(CreateProductDto, {
        ...valid,
        price: 1.005,
      });
      expect(errors.map((e) => e.property)).toContain("price");
    });
  });

  describe("ListProductsQueryDto", () => {
    // Defaults are deliberately NOT applied here — the service owns them, so
    // there is exactly one place that decides what "no page" means. Asserted so
    // the boundary stays where it is.
    it("leaves absent fields undefined for the service to default", () => {
      const dto = plainToInstance(ListProductsQueryDto, {});
      expect(dto.page).toBeUndefined();
      expect(dto.limit).toBeUndefined();
    });

    it("rejects a limit above the maximum", async () => {
      const errors = await validateDto(ListProductsQueryDto, { limit: 500 });
      expect(errors.map((e) => e.property)).toContain("limit");
    });

    it("rejects a non-positive page", async () => {
      const errors = await validateDto(ListProductsQueryDto, { page: 0 });
      expect(errors.map((e) => e.property)).toContain("page");
    });

    it("coerces numeric query strings", async () => {
      const dto = plainToInstance(ListProductsQueryDto, {
        page: "3",
        limit: "50",
      });
      await validate(dto);
      expect(dto.page).toBe(3);
      expect(dto.limit).toBe(50);
    });
  });

  describe("CreateCategoryDto", () => {
    it("accepts a trimmed name", async () => {
      const dto = plainToInstance(CreateCategoryDto, { name: "  Furniture  " });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.name).toBe("Furniture");
    });

    it("rejects a duplicate-looking empty name", async () => {
      const errors = await validateDto(CreateCategoryDto, { name: "  " });
      expect(errors.map((e) => e.property)).toContain("name");
    });
  });
});
