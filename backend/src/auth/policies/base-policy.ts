import { User, UserRole } from "../../entities/user.entity.js";

export abstract class BasePolicy {
  protected isAdmin(user: User): boolean {
    return user.role === UserRole.ADMIN;
  }
}
