import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "../../../entities/user.entity.js";
import { SellerProfilePolicy } from "../seller-profile.policy.js";

interface TestUser {
  id: string;
  role: UserRole;
}

interface TestProfile {
  id: string;
  userId: string;
}

const makeUser = (id: string, role: UserRole): TestUser => ({ id, role });

const makeProfile = (id: string, userId: string): TestProfile => ({
  id,
  userId,
});

const adminUser = makeUser("admin-1", UserRole.ADMIN);
const profileOwner = makeUser("user-1", UserRole.SELLER);
const otherUser = makeUser("user-2", UserRole.CUSTOMER);

const ownedProfile = makeProfile("profile-1", "user-1");
const otherProfile = makeProfile("profile-2", "user-2");

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
