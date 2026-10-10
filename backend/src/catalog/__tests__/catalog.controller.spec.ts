import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IS_PUBLIC_KEY } from "../../auth/decorators/public.decorator.js";
import { ROLES_KEY } from "../../auth/decorators/roles.decorator.js";
import { User, UserRole } from "../../entities/user.entity.js";
import { CatalogService } from "../catalog.service.js";
import { CategoriesController } from "../categories.controller.js";
import { ProductsController } from "../products.controller.js";

/**
 * The controller holds no business logic on purpose — every authorization
 * decision lives in `CatalogService` against `ProductPolicy`. What is worth
 * pinning here is the wiring that the service cannot defend for itself: that
 * the write routes actually carry the role metadata, that delete really returns
 * 204, and that a signed-in seller is passed through as the product's owner
 * rather than being taken from the body.
 */
const metadata = (key: string, handler: (...args: never[]) => unknown) =>
  Reflect.getMetadata(key, handler) as unknown;

const seller = { id: "seller-1", role: UserRole.SELLER } as User;

describe("ProductsController", () => {
  let catalogService: CatalogService;
  let controller: ProductsController;

  beforeEach(() => {
    vi.clearAllMocks();
    catalogService = {
      listProducts: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      }),
      findProductById: vi.fn(),
      createProduct: vi.fn(),
      updateProduct: vi.fn(),
      softDeleteProduct: vi.fn(),
    } as unknown as CatalogService;

    controller = new ProductsController(catalogService);
  });

  it("restricts writes to sellers and admins", () => {
    expect(metadata(ROLES_KEY, controller.create)).toEqual([
      UserRole.SELLER,
      UserRole.ADMIN,
    ]);
    expect(metadata(ROLES_KEY, controller.update)).toEqual([
      UserRole.SELLER,
      UserRole.ADMIN,
    ]);
    expect(metadata(ROLES_KEY, controller.remove)).toEqual([
      UserRole.SELLER,
      UserRole.ADMIN,
    ]);
  });

  it("leaves the reads public", () => {
    expect(metadata(IS_PUBLIC_KEY, controller.list)).toBe(true);
    expect(metadata(IS_PUBLIC_KEY, controller.findOne)).toBe(true);
    expect(metadata(ROLES_KEY, controller.list)).toBeUndefined();
    expect(metadata(ROLES_KEY, controller.findOne)).toBeUndefined();
  });

  it("answers a delete with 204, not 200 with an empty body", () => {
    expect(metadata("__httpCode__", controller.remove)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it("takes the seller from the token, so a body cannot forge ownership", async () => {
    const dto = { name: "Widget", price: 5 };

    await controller.create(dto, seller);

    expect(catalogService.createProduct).toHaveBeenCalledWith(dto, seller);
  });

  it("passes an absent user to findProductById as null, not undefined", async () => {
    await controller.findOne("product-1", undefined);

    // `canView(user, ...)` treats null and undefined the same, but the
    // anonymous case is worth being explicit about in one place.
    expect(catalogService.findProductById).toHaveBeenCalledWith(
      "product-1",
      null,
    );
  });

  it("passes a signed-in owner through to findProductById", async () => {
    await controller.findOne("product-1", seller);

    expect(catalogService.findProductById).toHaveBeenCalledWith(
      "product-1",
      seller,
    );
  });

  it("returns nothing on delete so Nest emits an empty 204", async () => {
    await expect(
      controller.remove("product-1", seller),
    ).resolves.toBeUndefined();
    expect(catalogService.softDeleteProduct).toHaveBeenCalledWith(
      "product-1",
      seller,
    );
  });
});

describe("CategoriesController", () => {
  let catalogService: CatalogService;
  let controller: CategoriesController;

  beforeEach(() => {
    vi.clearAllMocks();
    catalogService = {
      listCategories: vi.fn().mockResolvedValue([]),
      findCategoryById: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
    } as unknown as CatalogService;

    controller = new CategoriesController(catalogService);
  });

  it("restricts writes to admins", () => {
    expect(metadata(ROLES_KEY, controller.create)).toEqual([UserRole.ADMIN]);
    expect(metadata(ROLES_KEY, controller.update)).toEqual([UserRole.ADMIN]);
  });

  it("leaves the reads public", () => {
    expect(metadata(IS_PUBLIC_KEY, controller.list)).toBe(true);
    expect(metadata(IS_PUBLIC_KEY, controller.findOne)).toBe(true);
  });

  it("does not restrict writes to sellers", () => {
    // A seller picking a category is fine; a seller inventing one is not.
    expect(metadata(ROLES_KEY, controller.create)).not.toContain(
      UserRole.SELLER,
    );
  });
});
