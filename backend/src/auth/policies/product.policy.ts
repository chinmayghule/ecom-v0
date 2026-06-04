import { Injectable } from "@nestjs/common";
import { User } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

interface ProductLike {
  sellerId?: string;
  seller?: { id: string };
  isActive?: boolean;
}

@Injectable()
export class ProductPolicy extends BasePolicy {
  canEdit(user: User, product: ProductLike): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = product.sellerId ?? product.seller?.id;
    return user.id === ownerId;
  }

  canView(user: User | null, product: ProductLike): boolean {
    if (product.isActive) return true;
    if (this.isAdmin(user!)) return true;
    const ownerId = product.sellerId ?? product.seller?.id;
    if (user && user.id === ownerId) return true;
    return false;
  }
}
