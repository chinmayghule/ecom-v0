import { Injectable } from "@nestjs/common";
import type { SellerProfile } from "../../entities/seller-profile.entity.js";
import { User, UserRole } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

// Derived from the entity — see ProductSubject in product.policy.ts.
export type SellerProfileSubject = Partial<
  Pick<SellerProfile, "userId" | "user">
>;

@Injectable()
export class SellerProfilePolicy extends BasePolicy {
  canEdit(user: User, profile: SellerProfileSubject): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = profile.userId ?? profile.user?.id;
    return user.id === ownerId;
  }

  canView(_user: User, _profile: SellerProfileSubject): boolean {
    return true;
  }

  canCreate(user: User): boolean {
    if (this.isAdmin(user)) return true;
    return user.role === UserRole.SELLER;
  }
}
