import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { User } from "../../entities/user.entity.js";

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User | undefined;
    return data ? user?.[data] : user;
  },
);
