import { Injectable } from "@nestjs/common";
import type { Cart } from "../../entities/cart.entity.js";
import { User } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

// Derived from the entity, not hand-written — see ProductSubject in
// product.policy.ts for why an all-optional interface hides field drift.
export type CartSubject = Partial<Pick<Cart, "userId" | "user">>;

@Injectable()
export class CartPolicy extends BasePolicy {
  canEdit(user: User, cart: CartSubject): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = cart.userId ?? cart.user?.id;
    return user.id === ownerId;
  }

  canView(user: User, cart: CartSubject): boolean {
    return this.canEdit(user, cart);
  }
}
