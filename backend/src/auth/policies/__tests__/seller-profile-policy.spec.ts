import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { SellerProfilePolicy } from "../seller-profile.policy.js";

const adminUser = { id: "admin-1", role: UserRole.ADMIN } as any;
const profileOwner = { id: "user-1", role: UserRole.SELLER } as any;
const otherUser = { id: "user-2", role: UserRole.CUSTOMER } as any;

const ownedProfile = { id: "profile-1", userId: "user-1" } as any;
const otherProfile = { id: "profile-2", userId: "user-2" } as any;

describe("SellerProfilePolicy", () => {
  let policy: SellerProfilePolicy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SellerProfilePolicy],
    }).compile();
    policy = module.get(SellerProfilePolicy);
  });

  describe("canEdit", () => {
    it("allows owner to edit own profile", () => {
      expect(policy.canEdit(profileOwner, ownedProfile)).toBe(true);
    });
    it("denies non-owner from editing profile", () => {
      expect(policy.canEdit(otherUser, ownedProfile)).toBe(false);
    });
    it("allows admin to edit any profile", () => {
      expect(policy.canEdit(adminUser, otherProfile)).toBe(true);
    });
  });

  describe("canView", () => {
    it("allows anyone to view any profile", () => {
      expect(policy.canView(otherUser, otherProfile)).toBe(true);
      expect(policy.canView(profileOwner, ownedProfile)).toBe(true);
      expect(policy.canView(adminUser, ownedProfile)).toBe(true);
    });
  });
});
