import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import type { Product } from "../../../entities/product.entity.js";
import { UserRole } from "../../../entities/user.entity.js";
import { ProductPolicy } from "../product.policy.js";

interface TestUser {
  id: string;
  role: UserRole;
}

// Anchored to the real entity so a rename breaks compilation here too.
type TestProduct = Pick<Product, "isLive" | "sellerId">;

const makeUser = (id: string, role: UserRole): TestUser => ({ id, role });
const makeProduct = (sellerId: string, isLive: boolean): TestProduct => ({
  sellerId,
  isLive,
});

const customerUser = makeUser("cust-1", UserRole.CUSTOMER);
const activeProduct = makeProduct("seller-1", true);
const inactiveProduct = makeProduct("seller-2", false);

describe("ProductPolicy extended", () => {
  let policy: ProductPolicy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ProductPolicy],
    }).compile();
    policy = module.get(ProductPolicy);
  });

  describe("canView with null user", () => {
    it("allows null user to view active product", () => {
      expect(policy.canView(null, activeProduct)).toBe(true);
    });

    it("denies null user from viewing inactive product", () => {
      expect(policy.canView(null, inactiveProduct)).toBe(false);
    });

    it("allows authenticated non-owner to view active product", () => {
      expect(policy.canView(customerUser, activeProduct)).toBe(true);
    });
  });
});
