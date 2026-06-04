import { Injectable } from "@nestjs/common";
import { User } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

interface SellerProfileLike {
  userId?: string;
  user?: { id: string };
}

@Injectable()
export class SellerProfilePolicy extends BasePolicy {
  canEdit(user: User, profile: SellerProfileLike): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = profile.userId ?? profile.user?.id;
    return user.id === ownerId;
  }

  canView(_user: User, _profile: SellerProfileLike): boolean {
    return true;
  }
}
