import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { OrderPolicy } from "../order.policy.js";

const adminUser = { id: "admin-1", role: UserRole.ADMIN } as any;
const orderOwner = { id: "user-1", role: UserRole.CUSTOMER } as any;
const otherUser = { id: "user-2", role: UserRole.CUSTOMER } as any;

const ownedOrder = {
  id: "order-1",
  userId: "user-1",
  status: "pending",
} as any;
const otherOrder = {
  id: "order-2",
  userId: "user-2",
  status: "pending",
} as any;
const completedOrder = {
  id: "order-3",
  userId: "user-1",
  status: "completed",
} as any;

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
