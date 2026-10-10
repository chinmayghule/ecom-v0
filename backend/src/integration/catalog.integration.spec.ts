import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeAll, describe, expect, it } from "vitest";
import { useDataSource } from "../../test/setup.integration.js";
import { ProductPolicy } from "../auth/policies/product.policy.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { Category } from "../entities/category.entity.js";
import { Product } from "../entities/product.entity.js";
import { User, UserRole } from "../entities/user.entity.js";

/**
 * The catalogue, against a real PostgreSQL.
 *
 * Everything asserted below is something a mocked repository cannot decide.
 *
 * - `price` is `numeric(10,2)`, and `pg` returns it as a **string**. A mock
 *   that hands back `9.99` as a number proves the mapper works on data the
 *   driver never produces, which is how "price comes back as a string" reached
 *   production in the first place.
 * - `sellerId` / `categoryId` are `@RelationId` projections over real foreign
 *   keys. Whether `find({ where: { categoryId } })` even resolves is a question
 *   about TypeORM's metadata, not about the code under test.
 * - `@DeleteDateColumn` excludes rows at the SQL layer. A mock does not know
 *   what a tombstone is.
 * - `categories.name` is UNIQUE, so the 409 path needs an actual constraint
 *   violation to be reachable.
 *
 * The shared database is **not** truncated between spec files, so every
 * assertion is scoped by a per-run tag. Where a test needs "all my products",
 * `q` filters on the tag — which also exercises the search path on every
 * single call rather than only in the one test that is about search.
 */
describe("Catalog (integration)", () => {
  const tag = `catalog-${Date.now()}`;

  let service: CatalogService;
  let sellerA: User;
  let sellerB: User;
  let admin: User;

  const productNamed = (suffix: string) => `${tag}-${suffix}`;

  beforeAll(async () => {
    const ds = useDataSource();
    service = new CatalogService(
      ds.getRepository(Product),
      ds.getRepository(Category),
      new ProductPolicy(),
    );

    const users = ds.getRepository(User);
    const makeUser = async (label: string, role: UserRole) =>
      users.save(
        users.create({
          // `users.email` is UNIQUE and the database is not truncated between
          // runs, so the label has to be distinct per user, not just per run.
          email: `${tag}-${label}@example.com`,
          name: `Catalog ${label}`,
          passwordHash: "x",
          role,
        }),
      );

    sellerA = await makeUser("seller-a", UserRole.SELLER);
    sellerB = await makeUser("seller-b", UserRole.SELLER);
    admin = await makeUser("admin", UserRole.ADMIN);
  });

  // ---------------------------------------------------------------------------

  describe("public listing", () => {
    it("shows an anonymous caller only live products", async () => {
      // Its own sub-tag rather than the run tag: the database is not truncated
      // and the other cases in this file create more products, so a bare `q`
      // would make this assertion depend on test ordering.
      const visTag = `${tag}-vis`;
      const named = (suffix: string) => `${visTag}-${suffix}`;

      await service.createProduct(
        { name: named("live-1"), price: 9.99, isLive: true },
        sellerA,
      );
      await service.createProduct(
        { name: named("live-2"), price: 19.99, isLive: true },
        sellerA,
      );
      await service.createProduct(
        { name: named("draft-1"), price: 29.99, isLive: false },
        sellerA,
      );

      // The service has no user parameter here: this is the public listing and
      // it must never widen. No `isLive` filter means "draft" would be served.
      const result = await service.listProducts({ q: visTag, limit: 100 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items.every((p) => p.isLive)).toBe(true);
      expect(result.items.map((p) => p.name)).not.toContain(named("draft-1"));
    });

    it("returns price as a number, not the string `pg` produced", async () => {
      const created = await service.createProduct(
        { name: productNamed("priced"), price: 9.99, isLive: true },
        sellerA,
      );

      expect(created.price).toBe(9.99);
      expect(typeof created.price).toBe("number");

      const result = await service.listProducts({ q: productNamed("priced") });
      const found = result.items[0];

      expect(found).toBeDefined();
      // The regression this pins: `numeric` arrives as "9.99", so a client
      // comparing `price === 9.99` is silently false for every product.
      expect(typeof found.price).toBe("number");
      expect(found.price).toBe(9.99);
    });

    it("paginates: three products at limit 2 is two pages", async () => {
      const pageTag = `${tag}-page`;
      for (const n of [1, 2, 3]) {
        await service.createProduct(
          { name: `${pageTag}-${n}`, price: 5 + n, isLive: true },
          sellerA,
        );
      }

      const result = await service.listProducts({
        q: pageTag,
        page: 1,
        limit: 2,
      });

      expect(result.total).toBe(3);
      expect(result.items).toHaveLength(2);
      // Ceiling, not floor: floor(3/2) is 1, which hides the third product on
      // a page the client is never shown.
      expect(result.totalPages).toBe(2);

      const second = await service.listProducts({
        q: pageTag,
        page: 2,
        limit: 2,
      });
      expect(second.items).toHaveLength(1);
      expect(second.totalPages).toBe(2);
    });

    it("orders newest first", async () => {
      const orderTag = `${tag}-order`;
      await service.createProduct(
        { name: `${orderTag}-old`, price: 1, isLive: true },
        sellerA,
      );
      await service.createProduct(
        { name: `${orderTag}-new`, price: 2, isLive: true },
        sellerA,
      );

      const result = await service.listProducts({ q: orderTag, limit: 100 });

      expect(result.items.map((p) => p.name)).toEqual([
        `${orderTag}-new`,
        `${orderTag}-old`,
      ]);
    });

    it("searches names case-insensitively", async () => {
      await service.createProduct(
        { name: `${tag}-MixedCase-Widget`, price: 3, isLive: true },
        sellerA,
      );

      const result = await service.listProducts({
        q: `${tag}-mixedcase-widget`,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe(`${tag}-MixedCase-Widget`);
    });

    it("filters by an inclusive price range", async () => {
      const priceTag = `${tag}-pricerange`;
      for (const price of [5, 10, 15, 20, 25]) {
        await service.createProduct(
          { name: `${priceTag}-${price}`, price, isLive: true },
          sellerA,
        );
      }

      const result = await service.listProducts({ q: priceTag, limit: 100 });

      const asNumbers = result.items.map((p) => p.price).sort((a, b) => a - b);
      expect(asNumbers).toEqual([5, 10, 15, 20, 25]);

      const bounded = await service.listProducts({
        q: priceTag,
        minPrice: 10,
        maxPrice: 20,
        limit: 100,
      });
      // Inclusive at both ends — "between 10 and 20" means what a shopper
      // thinks it means.
      expect(bounded.items.map((p) => p.price).sort((a, b) => a - b)).toEqual([
        10, 15, 20,
      ]);

      const atLeast = await service.listProducts({
        q: priceTag,
        minPrice: 20,
        limit: 100,
      });
      expect(atLeast.items.map((p) => p.price).sort((a, b) => a - b)).toEqual([
        20, 25,
      ]);

      const atMost = await service.listProducts({
        q: priceTag,
        maxPrice: 10,
        limit: 100,
      });
      expect(atMost.items.map((p) => p.price).sort((a, b) => a - b)).toEqual([
        5, 10,
      ]);
    });

    it("filters by category through the derived foreign key", async () => {
      const catTag = `${tag}-cat`;
      const category = await service.createCategory({
        name: catTag,
        description: "integration",
      });

      await service.createProduct(
        {
          name: `${catTag}-in`,
          price: 1,
          categoryId: category.id,
          isLive: true,
        },
        sellerA,
      );
      await service.createProduct(
        { name: `${catTag}-out`, price: 2, isLive: true },
        sellerA,
      );

      // `categoryId` is an `@RelationId` projection, so whether this resolves at
      // all is a question about TypeORM's metadata rather than about this code.
      const result = await service.listProducts({
        q: catTag,
        categoryId: category.id,
        limit: 100,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe(`${catTag}-in`);
      expect(result.items[0]?.categoryId).toBe(category.id);
    });

    it("excludes soft-deleted rows", async () => {
      const doomed = await service.createProduct(
        { name: `${tag}-doomed`, price: 4, isLive: true },
        sellerA,
      );

      await service.softDeleteProduct(doomed.id, sellerA);

      const listed = await service.listProducts({ q: `${tag}-doomed` });
      expect(listed.items).toHaveLength(0);
      expect(listed.total).toBe(0);

      // And a direct read is gone too, not merely hidden from the listing.
      await expect(service.findProductById(doomed.id, sellerA)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------

  describe("reading a single product", () => {
    let draft: { id: string };

    beforeAll(async () => {
      const created = await service.createProduct(
        { name: `${tag}-private-draft`, price: 7.5, isLive: false },
        sellerA,
      );
      draft = { id: created.id };
    });

    it("hides an unpublished product from an anonymous caller", async () => {
      await expect(service.findProductById(draft.id, null)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("hides it from another seller, as 404 rather than 403", async () => {
      // 403 would confirm the draft exists — which is the exact thing the
      // policy withholds. The outsider must not be able to tell the two cases
      // apart.
      await expect(service.findProductById(draft.id, sellerB)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("shows it to its owner", async () => {
      const found = await service.findProductById(draft.id, sellerA);

      expect(found.id).toBe(draft.id);
      expect(found.isLive).toBe(false);
      expect(found.price).toBe(7.5);
    });

    it("shows it to an admin", async () => {
      await expect(
        service.findProductById(draft.id, admin),
      ).resolves.toMatchObject({ id: draft.id });
    });

    it("shows a live product to anyone, signed in or not", async () => {
      const live = await service.createProduct(
        { name: `${tag}-public-item`, price: 8.25, isLive: true },
        sellerA,
      );

      await expect(
        service.findProductById(live.id, null),
      ).resolves.toMatchObject({ id: live.id });
      await expect(
        service.findProductById(live.id, sellerB),
      ).resolves.toMatchObject({ id: live.id });
    });

    it("404s a product that does not exist", async () => {
      await expect(
        service.findProductById("00000000-0000-4000-8000-000000000000", admin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------

  describe("write authorisation", () => {
    let owned: { id: string };

    beforeAll(async () => {
      const created = await service.createProduct(
        { name: `${tag}-owned`, price: 12 },
        sellerA,
      );
      owned = { id: created.id };
    });

    it("scopes a new product to its creator", async () => {
      const created = await service.createProduct(
        { name: `${tag}-scoped`, price: 15 },
        sellerB,
      );

      // The FK that `ProductPolicy` reads, verified in the database rather
      // than in a fixture. A sellerId of undefined here would deny the real
      // owner their own listing on every subsequent request.
      const row = await useDataSource()
        .getRepository(Product)
        .findOne({
          where: { id: created.id },
        });

      expect(row?.sellerId).toBe(sellerB.id);
      expect(created.sellerId).toBe(sellerB.id);
    });

    it("stops seller B updating seller A's product", async () => {
      await expect(
        service.updateProduct(owned.id, { name: "hijacked" }, sellerB),
      ).rejects.toThrow(ForbiddenException);

      const row = await service.findProductById(owned.id, sellerA);
      expect(row.name).toBe(`${tag}-owned`);
    });

    it("stops seller B deleting seller A's product", async () => {
      await expect(
        service.softDeleteProduct(owned.id, sellerB),
      ).rejects.toThrow(ForbiddenException);

      // Untouched, and still readable by its owner afterwards.
      await expect(
        service.findProductById(owned.id, sellerA),
      ).resolves.toMatchObject({ id: owned.id });
    });

    it("lets an admin update any product", async () => {
      const updated = await service.updateProduct(
        owned.id,
        { name: `${tag}-owned-modified`, price: 21.5 },
        admin,
      );

      expect(updated.name).toBe(`${tag}-owned-modified`);
      expect(updated.price).toBe(21.5);
      expect(typeof updated.price).toBe("number");

      const row = await service.findProductById(owned.id, sellerA);
      expect(row.name).toBe(`${tag}-owned-modified`);
    });

    it("lets the owner update their own product", async () => {
      const updated = await service.updateProduct(
        owned.id,
        { price: 33.33 },
        sellerA,
      );

      expect(updated.price).toBe(33.33);
    });

    it("moves a product between categories", async () => {
      const from = await service.createCategory({ name: `${tag}-from` });
      const to = await service.createCategory({ name: `${tag}-to` });

      const created = await service.createProduct(
        { name: `${tag}-recategorised`, price: 5, categoryId: from.id },
        sellerA,
      );
      expect(created.categoryId).toBe(from.id);

      const updated = await service.updateProduct(
        created.id,
        { categoryId: to.id },
        sellerA,
      );

      // Assigning the derived `categoryId` property would have updated an
      // in-memory field with no column behind it and left the row untouched.
      expect(updated.categoryId).toBe(to.id);

      const row = await useDataSource()
        .getRepository(Product)
        .findOne({
          where: { id: created.id },
        });
      expect(row?.categoryId).toBe(to.id);
    });

    it("lets the owner soft-delete their own product", async () => {
      const created = await service.createProduct(
        { name: `${tag}-self-deleted`, price: 6 },
        sellerA,
      );

      await service.softDeleteProduct(created.id, sellerA);

      const row = await useDataSource()
        .getRepository(Product)
        .findOne({ where: { id: created.id }, withDeleted: true });

      // Both facts recorded: hidden from listings *and* tombstoned. A row that
      // was only unpublished would still be `deletedAt IS NULL` in every audit.
      expect(row?.isLive).toBe(false);
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it("cannot edit an already soft-deleted product", async () => {
      const created = await service.createProduct(
        { name: `${tag}-edit-after-delete`, price: 6 },
        sellerA,
      );
      await service.softDeleteProduct(created.id, sellerA);

      await expect(
        service.updateProduct(created.id, { price: 1 }, sellerA),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------

  describe("categories", () => {
    it("lists in alphabetical order", async () => {
      for (const name of [`${tag}-zzz`, `${tag}-aaa`, `${tag}-mmm`]) {
        await service.createCategory({ name });
      }

      const names = (await service.listCategories()).map((c) => c.name);
      const mine = names.filter((n) => n.startsWith(tag));

      expect(mine).toEqual([...mine].sort());
    });

    it("reports a duplicate name as a conflict, not a 500", async () => {
      const name = `${tag}-duplicate`;
      await service.createCategory({ name });

      // A UNIQUE violation surfacing as 500 tells the client to retry something
      // that can never succeed.
      await expect(service.createCategory({ name })).rejects.toThrow(
        /already exists/,
      );
    });

    it("renames a category", async () => {
      const created = await service.createCategory({ name: `${tag}-before` });

      const updated = await service.updateCategory(created.id, {
        name: `${tag}-after`,
      });

      expect(updated.name).toBe(`${tag}-after`);
      await expect(service.findCategoryById(created.id)).resolves.toMatchObject(
        { name: `${tag}-after` },
      );
    });

    it("404s a category that does not exist", async () => {
      await expect(
        service.findCategoryById("00000000-0000-4000-8000-000000000000"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------

  describe("price range validation", () => {
    it("rejects minPrice above maxPrice", async () => {
      await expect(
        service.listProducts({ minPrice: 100, maxPrice: 1 }),
      ).rejects.toThrow(/minPrice/);
    });
  });
});
