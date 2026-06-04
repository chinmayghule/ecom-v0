import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { CartPolicy } from "../cart.policy.js";

const adminUser = { id: "admin-1", role: UserRole.ADMIN } as any;
const cartOwner = { id: "user-1", role: UserRole.CUSTOMER } as any;
const otherUser = { id: "user-2", role: UserRole.CUSTOMER } as any;

const ownedCart = { id: "cart-1", userId: "user-1" } as any;
const otherCart = { id: "cart-2", userId: "user-2" } as any;

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
