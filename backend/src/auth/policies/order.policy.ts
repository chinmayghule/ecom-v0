import { Injectable } from "@nestjs/common";
import { type Order, OrderStatus } from "../../entities/order.entity.js";
import { User } from "../../entities/user.entity.js";
import { BasePolicy } from "./base-policy.js";

// Derived from the entity — see ProductSubject in product.policy.ts.
export type OrderSubject = Partial<Pick<Order, "userId" | "user" | "status">>;

@Injectable()
export class OrderPolicy extends BasePolicy {
  private isOwner(user: User, order: OrderSubject): boolean {
    return user.id === (order.userId ?? order.user?.id);
  }

  canView(user: User, order: OrderSubject): boolean {
    if (this.isAdmin(user)) return true;
    return this.isOwner(user, order);
  }

  canEdit(user: User, order: OrderSubject): boolean {
    if (this.isAdmin(user)) return true;
    return this.isOwner(user, order) && order.status === OrderStatus.PENDING;
  }

  canCancel(user: User, order: OrderSubject): boolean {
    if (this.isAdmin(user)) return true;
    if (!this.isOwner(user, order)) return false;
    // Compared against the enum rather than string literals so that a status
    // the database cannot actually hold is a compile error instead of a
    // branch that silently never fires. This used to also allow "confirmed",
    // which is not a member of OrderStatus and so matched nothing.
    return order.status === OrderStatus.PENDING;
  }
}
