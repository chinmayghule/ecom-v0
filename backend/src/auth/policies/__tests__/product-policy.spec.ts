import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import type { Product } from "../../../entities/product.entity.js";
import { type User, UserRole } from "../../../entities/user.entity.js";
import { ProductPolicy, type ProductSubject } from "../product.policy.js";

const makeUser = (id: string, role: UserRole): User => ({ id, role }) as User;

/**
 * Built with `Pick` off the real entity, so if `Product` is renamed the test
 * stops compiling instead of quietly testing a field the code never reads.
 *
 * This is the bug this file exists to prevent. The fixture used to declare
 * `isActive` while the entity and column are `isLive`. Every assertion passed,
 * because the policy and the fixture agreed with each other and disagreed with
 * the database.
 */
const makeProduct = (sellerId: string, isLive: boolean): ProductSubject =>
  ({ sellerId, isLive }) satisfies Pick<Product, "isLive" | "sellerId">;

const adminUser = makeUser("admin-1", UserRole.ADMIN);
const sellerUser = makeUser("seller-1", UserRole.SELLER);
const otherSellerUser = makeUser("seller-2", UserRole.SELLER);
const customerUser = makeUser("cust-1", UserRole.CUSTOMER);

const ownedLive = makeProduct("seller-1", true);
const otherLive = makeProduct("seller-2", true);
const otherDraft = makeProduct("seller-2", false);

describe("ProductPolicy", () => {
  let policy: ProductPolicy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProductPolicy],
    }).compile();
    policy = module.get(ProductPolicy);
  });

  describe("canEdit", () => {
    it("allows seller to edit own product", () => {
      expect(policy.canEdit(sellerUser, ownedLive)).toBe(true);
    });
    it("denies seller from editing another seller's product", () => {
      expect(policy.canEdit(sellerUser, otherLive)).toBe(false);
    });
    it("allows admin to edit any product", () => {
      expect(policy.canEdit(adminUser, otherLive)).toBe(true);
      expect(policy.canEdit(adminUser, ownedLive)).toBe(true);
    });
    it("denies customer from editing any product", () => {
      expect(policy.canEdit(customerUser, ownedLive)).toBe(false);
    });
    it("resolves the owner from a loaded relation when no FK is present", () => {
      const viaRelation: ProductSubject = {
        isLive: true,
        seller: { id: "seller-1" } as User,
      };
      expect(policy.canEdit(sellerUser, viaRelation)).toBe(true);
      expect(policy.canEdit(customerUser, viaRelation)).toBe(false);
    });
  });

  describe("canView", () => {
    // The regression. `canView` used to branch on `product.isActive`, which the
    // entity never had, so it was always undefined: anonymous visitors and
    // non-owning users were denied every product, live or not.
    it("lets an anonymous visitor see a live product", () => {
      expect(policy.canView(null, ownedLive)).toBe(true);
      expect(policy.canView(null, otherLive)).toBe(true);
    });
    it("lets any signed-in user see a live product", () => {
      expect(policy.canView(customerUser, ownedLive)).toBe(true);
      expect(policy.canView(customerUser, otherLive)).toBe(true);
    });
    it("denies an anonymous visitor an unpublished product", () => {
      expect(policy.canView(null, otherDraft)).toBe(false);
    });
    it("allows owner to view their unpublished product", () => {
      expect(policy.canView(otherSellerUser, otherDraft)).toBe(true);
    });
    it("allows admin to view unpublished products", () => {
      expect(policy.canView(adminUser, otherDraft)).toBe(true);
    });
    it("denies non-owner non-admin from viewing an unpublished product", () => {
      expect(policy.canView(customerUser, otherDraft)).toBe(false);
      expect(policy.canView(sellerUser, otherDraft)).toBe(false);
    });
  });
});
