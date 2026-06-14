import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { CartPolicy } from "../cart.policy.js";

interface TestUser {
  id: string;
  role: UserRole;
}

interface TestCart {
  id: string;
  userId: string;
}

const makeUser = (id: string, role: UserRole): TestUser => ({ id, role });

const makeCart = (id: string, userId: string): TestCart => ({ id, userId });

const adminUser = makeUser("admin-1", UserRole.ADMIN);
const cartOwner = makeUser("user-1", UserRole.CUSTOMER);
const otherUser = makeUser("user-2", UserRole.CUSTOMER);

const ownedCart = makeCart("cart-1", "user-1");
const otherCart = makeCart("cart-2", "user-2");

describe("CartPolicy", () => {
  let policy: CartPolicy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CartPolicy],
    }).compile();
    policy = module.get(CartPolicy);
  });

  describe("canEdit", () => {
    it("allows owner to edit own cart", () => {
      expect(policy.canEdit(cartOwner, ownedCart)).toBe(true);
    });
    it("denies non-owner from editing cart", () => {
      expect(policy.canEdit(otherUser, ownedCart)).toBe(false);
    });
    it("allows admin to edit any cart", () => {
      expect(policy.canEdit(adminUser, otherCart)).toBe(true);
    });
  });

  describe("canView", () => {
    it("allows owner to view own cart", () => {
      expect(policy.canView(cartOwner, ownedCart)).toBe(true);
    });
    it("denies non-owner from viewing cart", () => {
      expect(policy.canView(otherUser, ownedCart)).toBe(false);
    });
    it("allows admin to view any cart", () => {
      expect(policy.canView(adminUser, otherCart)).toBe(true);
    });
  });
});
