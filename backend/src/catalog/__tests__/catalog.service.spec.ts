import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FindOperator, type FindOptionsWhere, QueryFailedError } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductPolicy } from "../../auth/policies/product.policy.js";
import { Category } from "../../entities/category.entity.js";
import { Product } from "../../entities/product.entity.js";
import { User, UserRole } from "../../entities/user.entity.js";
import { CatalogService } from "../catalog.service.js";

const SELLER_A = "seller-a";
const SELLER_B = "seller-b";

const asUser = (id: string, role: UserRole): User => ({ id, role }) as User;

const sellerA = asUser(SELLER_A, UserRole.SELLER);
const sellerB = asUser(SELLER_B, UserRole.SELLER);
const admin = asUser("admin-1", UserRole.ADMIN);
const customer = asUser("customer-1", UserRole.CUSTOMER);

/**
 * A row as `pg` actually returns it.
 *
 * `price` is a **string** because `products.price` is `numeric(10,2)`, and
 * `sellerId`/`categoryId` are present because they are `@RelationId`
 * projections that a plain `find` materialises without a join. Anything less
 * faithful than this makes the test agree with the code by construction — the
 * exact failure mode that let `canView` read `isActive` for so long.
 *
 * The override type widens `price` to `string` on purpose. The entity declares
 * `price!: number`, which is precisely the lie this file exists to expose — so
 * the fixture has to be allowed to say what the driver says.
 */
const dbProduct = (
  overrides: Omit<Partial<Product>, "price"> & { price?: number | string } = {},
): Product =>
  ({
    id: "product-1",
    name: "Widget",
    description: "A widget",
    price: "9.99",
    imageUrl: null,
    isLive: true,
    sellerId: SELLER_A,
    categoryId: null,
    seller: undefined as never,
    category: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  }) as unknown as Product;

interface RepoMock {
  find: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  findAndCount: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  softDelete: ReturnType<typeof vi.fn>;
}

describe("CatalogService", () => {
  let service: CatalogService;
  let productRepo: RepoMock;
  let categoryRepo: RepoMock;

  const lastWhere = (): FindOptionsWhere<Product> => {
    const [options] = productRepo.findAndCount.mock.calls.at(-1) ?? [{}];
    return (options as { where: FindOptionsWhere<Product> }).where;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    productRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      // Mirrors TypeORM: `create` returns the input as a new entity instance.
      create: vi.fn((data: object) => ({ ...data })),
      save: vi.fn(async (entity: object) => ({
        ...entity,
        id: (entity as { id?: string }).id ?? "product-1",
      })),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    categoryRepo = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue(null),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      create: vi.fn((data: object) => ({ ...data })),
      save: vi.fn(async (entity: object) => ({
        ...entity,
        id: (entity as { id?: string }).id ?? "category-1",
      })),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      softDelete: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
        ProductPolicy,
      ],
    }).compile();

    // Built through DI rather than `new`, so the `@InjectRepository` tokens are
    // proven to resolve to the repositories this module actually asks for.
    service = module.get(CatalogService);
  });

  // -------------------------------------------------------------------------

  describe("listProducts", () => {
    it("defaults to page 1 / limit 20 and orders newest first", async () => {
      await service.listProducts({});

      expect(productRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          order: { createdAt: "DESC" },
        }),
      );

      const result = await service.listProducts({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("only ever lists live products, whatever the caller asks for", async () => {
      await service.listProducts({ sellerId: "some-seller" });

      // Not "the caller's criteria plus isLive" — isLive is the one term that
      // is not negotiable on a public endpoint.
      expect(lastWhere().isLive).toBe(true);
    });

    describe("pagination math", () => {
      it("rounds up: 3 items at limit 2 is 2 pages", async () => {
        productRepo.findAndCount.mockResolvedValue([
          [dbProduct(), dbProduct()],
          3,
        ]);

        const result = await service.listProducts({ page: 1, limit: 2 });

        expect(result.total).toBe(3);
        expect(result.totalPages).toBe(2);
        expect(result.items).toHaveLength(2);
        // floor() here would report 1 page and hide the third item.
        expect(result.totalPages).not.toBe(1);
      });

      it("does not invent a page for an exact multiple", async () => {
        productRepo.findAndCount.mockResolvedValue([[dbProduct()], 4]);

        const result = await service.listProducts({ page: 1, limit: 2 });

        expect(result.totalPages).toBe(2);
      });

      it("reports zero pages for an empty catalogue", async () => {
        productRepo.findAndCount.mockResolvedValue([[], 0]);

        const result = await service.listProducts({});

        expect(result.totalPages).toBe(0);
      });

      it("translates page/limit into a skip", async () => {
        await service.listProducts({ page: 4, limit: 10 });

        expect(productRepo.findAndCount).toHaveBeenCalledWith(
          expect.objectContaining({ skip: 30, take: 10 }),
        );
      });
    });

    describe("price conversion", () => {
      it("returns a number, never the string `pg` produced", async () => {
        productRepo.findAndCount.mockResolvedValue([
          [dbProduct({ price: "9.99" })],
          1,
        ]);

        const result = await service.listProducts({});

        expect(result.items[0].price).toBe(9.99);
        expect(typeof result.items[0].price).toBe("number");
      });

      it("preserves cents that a float round-trip would lose", async () => {
        productRepo.findAndCount.mockResolvedValue([
          [dbProduct({ price: "0.10" })],
          1,
        ]);

        const result = await service.listProducts({});

        expect(result.items[0].price).toBe(0.1);
      });

      it("fails loudly rather than repricing a catalogue when price is unreadable", async () => {
        productRepo.findAndCount.mockResolvedValue([
          [dbProduct({ price: null as never })],
          1,
        ]);

        // Returning 0 here would be a silent, plausible-looking wrong price.
        await expect(service.listProducts({})).rejects.toThrow();
      });
    });

    describe("price range", () => {
      it("rejects minPrice greater than maxPrice without touching the database", async () => {
        await expect(
          service.listProducts({ minPrice: 50, maxPrice: 10 }),
        ).rejects.toThrow(BadRequestException);

        expect(productRepo.findAndCount).not.toHaveBeenCalled();
      });

      it("accepts minPrice equal to maxPrice", async () => {
        productRepo.findAndCount.mockResolvedValue([[], 0]);

        await expect(
          service.listProducts({ minPrice: 10, maxPrice: 10 }),
        ).resolves.toMatchObject({ total: 0 });
      });

      it("uses an inclusive range when both bounds are given", async () => {
        await service.listProducts({ minPrice: 10, maxPrice: 20 });

        const op = lastWhere().price as FindOperator<number>;
        expect(op).toBeInstanceOf(FindOperator);
        expect(op.type).toBe("between");
        expect(op.value).toEqual([10, 20]);
      });

      it("uses a single lower bound when only minPrice is given", async () => {
        await service.listProducts({ minPrice: 10 });

        const op = lastWhere().price as FindOperator<number>;
        expect(op.type).toBe("moreThanOrEqual");
        expect(op.value).toBe(10);
      });

      it("uses a single upper bound when only maxPrice is given", async () => {
        await service.listProducts({ maxPrice: 20 });

        const op = lastWhere().price as FindOperator<number>;
        expect(op.type).toBe("lessThanOrEqual");
        expect(op.value).toBe(20);
      });

      it("sets no price criterion when neither bound is given", async () => {
        await service.listProducts({});

        expect(lastWhere().price).toBeUndefined();
      });
    });

    describe("category filter", () => {
      it("filters through the relation, because categoryId is derived", async () => {
        await service.listProducts({ categoryId: "cat-1" });

        // `where: { categoryId }` throws `EntityPropertyNotFoundError` — an
        // `@RelationId` projection has no column mapping in the find-options
        // builder even though it reads fine on a loaded entity.
        expect(lastWhere().category).toEqual({ id: "cat-1" });
        expect(lastWhere()).not.toHaveProperty("categoryId");
      });

      it("omits the filter entirely when not supplied", async () => {
        await service.listProducts({});

        expect(lastWhere().category).toBeUndefined();
        expect(lastWhere().seller).toBeUndefined();
      });
    });

    describe("seller filter", () => {
      it("filters through the relation, not through sellerId", async () => {
        await service.listProducts({ sellerId: "seller-1" });

        expect(lastWhere().seller).toEqual({ id: "seller-1" });
        expect(lastWhere()).not.toHaveProperty("sellerId");
      });
    });

    describe("q search", () => {
      it("builds a case-insensitive name match", async () => {
        await service.listProducts({ q: "widget" });

        const op = lastWhere().name as FindOperator<string>;
        expect(op).toBeInstanceOf(FindOperator);
        expect(op.type).toBe("ilike");
        expect(op.value).toBe("%widget%");
      });

      it("trims the term", async () => {
        await service.listProducts({ q: "  widget  " });

        const op = lastWhere().name as FindOperator<string>;
        expect(op.value).toBe("%widget%");
      });

      it("treats a whitespace-only term as no search", async () => {
        await service.listProducts({ q: "   " });

        // `%%` would match every row and look like the filter did nothing.
        expect(lastWhere().name).toBeUndefined();
      });

      it("escapes LIKE wildcards in the user's term", async () => {
        await service.listProducts({ q: "50% off_" });

        const op = lastWhere().name as FindOperator<string>;
        // Unescaped, this is a pattern that matches nearly everything.
        expect(op.value).toBe("%50\\% off\\_%");
      });
    });

    it("never returns a raw entity to the caller", async () => {
      productRepo.findAndCount.mockResolvedValue([[dbProduct()], 1]);

      const result = await service.listProducts({});

      expect(result.items[0]).not.toHaveProperty("deletedAt");
      expect(result.items[0]).not.toHaveProperty("seller");
    });
  });

  // -------------------------------------------------------------------------

  describe("findProductById", () => {
    it("serves a live product to an anonymous caller", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ isLive: true }));

      const result = await service.findProductById("product-1", null);

      expect(result.id).toBe("product-1");
    });

    it("hides an unpublished product from an anonymous caller", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ isLive: false }));

      await expect(service.findProductById("product-1", null)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("hides an unpublished product from another seller", async () => {
      productRepo.findOne.mockResolvedValue(
        dbProduct({ isLive: false, sellerId: SELLER_A }),
      );

      await expect(
        service.findProductById("product-1", sellerB),
      ).rejects.toThrow(NotFoundException);
    });

    it("shows the owner their own unpublished product", async () => {
      productRepo.findOne.mockResolvedValue(
        dbProduct({ isLive: false, sellerId: SELLER_A }),
      );

      const result = await service.findProductById("product-1", sellerA);

      expect(result.id).toBe("product-1");
      expect(result.isLive).toBe(false);
    });

    it("shows an admin any product", async () => {
      productRepo.findOne.mockResolvedValue(
        dbProduct({ isLive: false, sellerId: SELLER_A }),
      );

      await expect(
        service.findProductById("product-1", admin),
      ).resolves.toMatchObject({ id: "product-1" });
    });

    it("404s a product that does not exist", async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(service.findProductById("nope", admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("does not ask the database for soft-deleted rows", async () => {
      productRepo.findOne.mockResolvedValue(null);

      await service.findProductById("product-1", admin).catch(() => undefined);

      // `withDeleted: true` here would resurrect tombstones into the API.
      expect(productRepo.findOne).toHaveBeenCalledWith({
        where: { id: "product-1" },
      });
    });
  });

  // -------------------------------------------------------------------------

  describe("createProduct", () => {
    it("scopes the product to the signed-in seller, not the request body", async () => {
      productRepo.findOne.mockResolvedValue(
        dbProduct({ sellerId: SELLER_A, name: "New" }),
      );

      await service.createProduct({ name: "New", price: 5 }, sellerA);

      const created = productRepo.create.mock.calls[0]?.[0] as {
        seller: { id: string };
      };
      expect(created.seller).toEqual({ id: SELLER_A });
      expect(created).not.toHaveProperty("sellerId");
    });

    it("creates a draft unless the seller explicitly publishes", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct());

      await service.createProduct({ name: "New", price: 5 }, sellerA);

      const created = productRepo.create.mock.calls[0]?.[0] as {
        isLive: boolean;
      };
      expect(created.isLive).toBe(false);
    });

    it("honours an explicit isLive", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ isLive: true }));

      await service.createProduct(
        { name: "New", price: 5, isLive: true },
        sellerA,
      );

      const created = productRepo.create.mock.calls[0]?.[0] as {
        isLive: boolean;
      };
      expect(created.isLive).toBe(true);
    });

    it("writes the category as a relation, because categoryId is derived", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ categoryId: "cat-9" }));

      await service.createProduct(
        { name: "New", price: 5, categoryId: "cat-9" },
        sellerA,
      );

      const created = productRepo.create.mock.calls[0]?.[0] as {
        category: { id: string } | null;
      };
      expect(created.category).toEqual({ id: "cat-9" });
    });

    it("re-reads after save so sellerId and categoryId are real", async () => {
      productRepo.findOne.mockResolvedValue(
        dbProduct({ sellerId: SELLER_A, categoryId: "cat-9", price: "12.34" }),
      );

      const result = await service.createProduct(
        { name: "New", price: 12.34, categoryId: "cat-9" },
        sellerA,
      );

      // `save` echoes the object it was handed, in which both are undefined.
      expect(result.sellerId).toBe(SELLER_A);
      expect(result.categoryId).toBe("cat-9");
      expect(result.price).toBe(12.34);
    });
  });

  // -------------------------------------------------------------------------

  describe("updateProduct", () => {
    it("refuses an update from a seller who does not own the product", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ sellerId: SELLER_A }));

      await expect(
        service.updateProduct("product-1", { name: "Hijacked" }, sellerB),
      ).rejects.toThrow(ForbiddenException);

      expect(productRepo.save).not.toHaveBeenCalled();
    });

    it("refuses an update from a plain customer", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ sellerId: SELLER_A }));

      await expect(
        service.updateProduct("product-1", { name: "Nope" }, customer),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lets the owner update their own product", async () => {
      productRepo.findOne
        .mockResolvedValueOnce(dbProduct({ sellerId: SELLER_A }))
        .mockResolvedValueOnce(
          dbProduct({ sellerId: SELLER_A, name: "Renamed" }),
        );
      productRepo.save.mockImplementation(async (entity: object) => entity);

      const result = await service.updateProduct(
        "product-1",
        { name: "Renamed" },
        sellerA,
      );

      expect(result.name).toBe("Renamed");
    });

    it("lets an admin update anyone's product", async () => {
      productRepo.findOne
        .mockResolvedValueOnce(dbProduct({ sellerId: SELLER_A }))
        .mockResolvedValueOnce(
          dbProduct({ sellerId: SELLER_A, name: "Moderated" }),
        );
      productRepo.save.mockImplementation(async (entity: object) => entity);

      const result = await service.updateProduct(
        "product-1",
        { name: "Moderated" },
        admin,
      );

      expect(result.name).toBe("Moderated");
    });

    it("maps categoryId onto the relation, not onto the derived property", async () => {
      const stored = dbProduct({ sellerId: SELLER_A });
      productRepo.findOne.mockResolvedValue(stored);

      await service
        .updateProduct("product-1", { categoryId: "cat-2" }, sellerA)
        .catch(() => undefined);

      expect(stored.category).toEqual({ id: "cat-2" });
      // Writing this would update an in-memory value `save` has no column for.
      expect(stored).not.toHaveProperty("categoryId", "cat-2");
    });

    it("404s a product that does not exist, before any permission question", async () => {
      productRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProduct("nope", { name: "x" }, sellerA),
      ).rejects.toThrow(NotFoundException);

      expect(productRepo.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------

  describe("softDeleteProduct", () => {
    it("refuses a delete from a seller who does not own the product", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ sellerId: SELLER_A }));

      await expect(
        service.softDeleteProduct("product-1", sellerB),
      ).rejects.toThrow(ForbiddenException);

      expect(productRepo.update).not.toHaveBeenCalled();
      expect(productRepo.softDelete).not.toHaveBeenCalled();
    });

    it("unpublishes before tombstoning, so both facts are recorded", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ sellerId: SELLER_A }));

      await service.softDeleteProduct("product-1", sellerA);

      // Order matters: update-then-delete. `isLive` is what stops the product
      // being served, `deletedAt` is what stops it being found.
      expect(productRepo.update).toHaveBeenCalledWith("product-1", {
        isLive: false,
      });
      expect(productRepo.softDelete).toHaveBeenCalledWith("product-1");
      expect(productRepo.update.mock.invocationCallOrder[0]).toBeLessThan(
        productRepo.softDelete.mock.invocationCallOrder[0],
      );
    });

    it("lets an admin delete anyone's product", async () => {
      productRepo.findOne.mockResolvedValue(dbProduct({ sellerId: SELLER_A }));

      await service.softDeleteProduct("product-1", admin);

      expect(productRepo.softDelete).toHaveBeenCalledWith("product-1");
    });

    it("404s a product that is already soft-deleted", async () => {
      // `findOne` without `withDeleted` returns null for a tombstone.
      productRepo.findOne.mockResolvedValue(null);

      await expect(
        service.softDeleteProduct("product-1", sellerA),
      ).rejects.toThrow(NotFoundException);

      expect(productRepo.softDelete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------

  describe("categories", () => {
    const dbCategory = (overrides: Partial<Category> = {}): Category =>
      ({
        id: "cat-1",
        name: "Tools",
        description: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        deletedAt: null,
        ...overrides,
      }) as Category;

    it("lists alphabetically", async () => {
      categoryRepo.find.mockResolvedValue([dbCategory()]);

      await service.listCategories();

      expect(categoryRepo.find).toHaveBeenCalledWith({
        order: { name: "ASC" },
      });
    });

    it("404s a missing category", async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(service.findCategoryById("nope")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("turns a unique-name violation into a 409, not a 500", async () => {
      categoryRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT INTO "categories"', [], {
          code: "23505",
        } as never),
      );

      await expect(service.createCategory({ name: "Tools" })).rejects.toThrow(
        /already exists/,
      );
    });

    it("does not mask unrelated database errors", async () => {
      categoryRepo.save.mockRejectedValue(
        new QueryFailedError('INSERT INTO "categories"', [], {
          code: "23502",
        } as never),
      );

      await expect(
        service.createCategory({ name: "Tools" }),
      ).rejects.not.toThrow(/already exists/);
    });

    it("renames a category", async () => {
      categoryRepo.findOne.mockResolvedValue(dbCategory());
      categoryRepo.save.mockImplementation(async (entity: object) => entity);

      const result = await service.updateCategory("cat-1", {
        name: "Power Tools",
      });

      expect(result.name).toBe("Power Tools");
    });

    it("404s when renaming something that does not exist", async () => {
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCategory("nope", { name: "x" }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
