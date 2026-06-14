import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { ProductPolicy } from "../product.policy.js";

interface TestUser {
  id: string;
  role: UserRole;
}

interface TestProduct {
  id: string;
  sellerId: string;
  isActive: boolean;
}

const makeUser = (id: string, role: UserRole): TestUser => ({ id, role });

const makeProduct = (
  id: string,
  sellerId: string,
  isActive: boolean,
): TestProduct => ({ id, sellerId, isActive });

const adminUser = makeUser("admin-1", UserRole.ADMIN);
const sellerUser = makeUser("seller-1", UserRole.SELLER);
const otherSellerUser = makeUser("seller-2", UserRole.SELLER);
const customerUser = makeUser("cust-1", UserRole.CUSTOMER);

const ownedProduct = makeProduct("prod-1", "seller-1", true);
const otherProduct = makeProduct("prod-2", "seller-2", true);
const inactiveProduct = makeProduct("prod-3", "seller-2", false);

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
      expect(policy.canEdit(sellerUser, ownedProduct)).toBe(true);
    });
    it("denies seller from editing another seller's product", () => {
      expect(policy.canEdit(sellerUser, otherProduct)).toBe(false);
    });
    it("allows admin to edit any product", () => {
      expect(policy.canEdit(adminUser, otherProduct)).toBe(true);
      expect(policy.canEdit(adminUser, ownedProduct)).toBe(true);
    });
    it("denies customer from editing any product", () => {
      expect(policy.canEdit(customerUser, ownedProduct)).toBe(false);
    });
  });

  describe("canView", () => {
    it("allows anyone to view active products", () => {
      expect(policy.canView(null, ownedProduct)).toBe(true);
      expect(policy.canView(customerUser, ownedProduct)).toBe(true);
      expect(policy.canView(adminUser, ownedProduct)).toBe(true);
    });
    it("allows owner to view inactive products", () => {
      expect(policy.canView(otherSellerUser, inactiveProduct)).toBe(true);
    });
    it("allows admin to view inactive products", () => {
      expect(policy.canView(adminUser, inactiveProduct)).toBe(true);
    });
    it("denies non-owner non-admin from viewing inactive products", () => {
      expect(policy.canView(customerUser, inactiveProduct)).toBe(false);
    });
  });
});
