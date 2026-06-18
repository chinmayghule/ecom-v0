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

const pendingOrder = makeOrder("order-1", "user-1", "pending");
const confirmedOrder = makeOrder("order-2", "user-1", "confirmed");
const shippedOrder = makeOrder("order-3", "user-1", "shipped");
const otherOrder = makeOrder("order-4", "user-2", "pending");

describe("OrderPolicy extended", () => {
  let policy: OrderPolicy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrderPolicy],
    }).compile();
    policy = module.get(OrderPolicy);
  });

  describe("canCancel", () => {
    it("allows owner to cancel pending order", () => {
      expect(policy.canCancel(orderOwner, pendingOrder)).toBe(true);
    });

    it("allows owner to cancel confirmed order", () => {
      expect(policy.canCancel(orderOwner, confirmedOrder)).toBe(true);
    });

    it("denies owner from cancelling shipped order", () => {
      expect(policy.canCancel(orderOwner, shippedOrder)).toBe(false);
    });

    it("denies non-owner from cancelling order", () => {
      expect(policy.canCancel(otherUser, pendingOrder)).toBe(false);
    });

    it("allows admin to cancel any order", () => {
      expect(policy.canCancel(adminUser, otherOrder)).toBe(true);
    });

    it("allows admin to cancel shipped order", () => {
      expect(policy.canCancel(adminUser, shippedOrder)).toBe(true);
    });
  });
});
