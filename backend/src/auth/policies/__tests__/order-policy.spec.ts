import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { OrderPolicy } from "../order.policy.js";

interface TestUser {
  id: string;
  role: UserRole;
}

interface TestOrder {
  id: string;
  userId: string;
  status: string;
}

const makeUser = (id: string, role: UserRole): TestUser => ({ id, role });

const makeOrder = (id: string, userId: string, status: string): TestOrder => ({
  id,
  userId,
  status,
});

const adminUser = makeUser("admin-1", UserRole.ADMIN);
const orderOwner = makeUser("user-1", UserRole.CUSTOMER);
const otherUser = makeUser("user-2", UserRole.CUSTOMER);

const ownedOrder = makeOrder("order-1", "user-1", "pending");
const otherOrder = makeOrder("order-2", "user-2", "pending");
const completedOrder = makeOrder("order-3", "user-1", "completed");

describe("OrderPolicy", () => {
  let policy: OrderPolicy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrderPolicy],
    }).compile();
    policy = module.get(OrderPolicy);
  });

  describe("canView", () => {
    it("allows owner to view own order", () => {
      expect(policy.canView(orderOwner, ownedOrder)).toBe(true);
    });
    it("denies non-owner from viewing order", () => {
      expect(policy.canView(otherUser, ownedOrder)).toBe(false);
    });
    it("allows admin to view any order", () => {
      expect(policy.canView(adminUser, otherOrder)).toBe(true);
    });
  });

  describe("canEdit", () => {
    it("allows owner to edit pending order", () => {
      expect(policy.canEdit(orderOwner, ownedOrder)).toBe(true);
    });
    it("denies owner from editing completed order", () => {
      expect(policy.canEdit(orderOwner, completedOrder)).toBe(false);
    });
    it("allows admin to edit any order", () => {
      expect(policy.canEdit(adminUser, otherOrder)).toBe(true);
    });
    it("denies non-owner from editing order", () => {
      expect(policy.canEdit(otherUser, ownedOrder)).toBe(false);
    });
  });
});
