import { Injectable } from "@nestjs/common";
import type { Product } from "../../entities/product.entity.js";
import { User } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

/**
 * What a policy needs in order to decide, anchored to the real entity.
 *
 * The scalar fields are a `Pick` from `Product` rather than a hand-written
 * shape. The hand-written version declared `isActive`, while the entity and the
 * database column are both `isLive` — so `canView` read `undefined` and denied
 * every anonymous visitor and every non-owner sight of a published product.
 *
 * Because the old shape had *every* field optional, a real `Product` satisfied
 * it and nothing typechecked. Deriving from the entity makes a rename on either
 * side a compile error instead of a silent authorisation failure.
 *
 * The relation is optional so callers may pass either a loaded entity or one
 * that only has the FK column.
 */
export type ProductSubject = Pick<Product, "isLive"> &
  Partial<Pick<Product, "sellerId" | "seller">>;

@Injectable()
export class ProductPolicy extends BasePolicy {
  private ownerId(product: ProductSubject): string | undefined {
    return product.sellerId ?? product.seller?.id;
  }

  canEdit(user: User, product: ProductSubject): boolean {
    if (this.isAdmin(user)) return true;
    return user.id === this.ownerId(product);
  }

  canView(user: User | null, product: ProductSubject): boolean {
    // Live products are public. This must be `isLive` — see ProductSubject.
    if (product.isLive) return true;
    if (!user) return false;
    if (this.isAdmin(user)) return true;
    return user.id === this.ownerId(product);
  }
}
