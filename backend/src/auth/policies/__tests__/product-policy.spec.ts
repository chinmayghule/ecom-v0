import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { ProductPolicy } from "../product.policy.js";

const adminUser = {
  id: "admin-1",
  role: UserRole.ADMIN,
  email: "admin@test.com",
} as any;
const sellerUser = {
  id: "seller-1",
  role: UserRole.SELLER,
  email: "seller@test.com",
} as any;
const otherSellerUser = {
  id: "seller-2",
  role: UserRole.SELLER,
  email: "other@test.com",
} as any;
const customerUser = {
  id: "cust-1",
  role: UserRole.CUSTOMER,
  email: "cust@test.com",
} as any;

const ownedProduct = {
  id: "prod-1",
  sellerId: "seller-1",
  isActive: true,
} as any;
const otherProduct = {
  id: "prod-2",
  sellerId: "seller-2",
  isActive: true,
} as any;
const inactiveProduct = {
  id: "prod-3",
  sellerId: "seller-2",
  isActive: false,
} as any;

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
      expect(policy.canView(null as any, ownedProduct)).toBe(true);
      expect(policy.canView(customerUser, ownedProduct)).toBe(true);
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
