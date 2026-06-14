import { Injectable } from "@nestjs/common";
import { User } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

interface CartLike {
  userId?: string;
  user?: { id: string };
}

@Injectable()
export class CartPolicy extends BasePolicy {
  canEdit(user: User, cart: CartLike): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = cart.userId ?? cart.user?.id;
    return user.id === ownerId;
  }

  canView(user: User, cart: CartLike): boolean {
    return this.canEdit(user, cart);
  }
}
