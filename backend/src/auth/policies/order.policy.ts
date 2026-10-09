import { Injectable } from "@nestjs/common";
import { User } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

interface OrderLike {
  userId?: string;
  user?: { id: string };
  status?: string;
}

@Injectable()
export class OrderPolicy extends BasePolicy {
  canView(user: User, order: OrderLike): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = order.userId ?? order.user?.id;
    return user.id === ownerId;
  }

  canEdit(user: User, order: OrderLike): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = order.userId ?? order.user?.id;
    return user.id === ownerId && order.status === "pending";
  }

  canCancel(user: User, order: OrderLike): boolean {
    if (this.isAdmin(user)) return true;
    const ownerId = order.userId ?? order.user?.id;
    if (user.id !== ownerId) return false;
    return order.status === "pending" || order.status === "confirmed";
  }
}
