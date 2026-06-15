import {
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ModuleRef, Reflector } from "@nestjs/core";
import { CHECK_POLICIES_KEY } from "../decorators/check-policies.decorator.js";
import type { PolicyHandler } from "../interfaces/policy-handler.interface.js";

@Injectable()
export class PoliciesGuard {
  private readonly logger = new Logger(PoliciesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers =
      this.reflector.getAllAndOverride<PolicyHandler[]>(CHECK_POLICIES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (handlers.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new UnauthorizedException();

    const resource = request.resource || request.params?.resource;

    for (const handler of handlers) {
      const policyInstance = this.moduleRef.get(handler.policyClass, {
        strict: false,
      });
      // biome-ignore lint/suspicious/noExplicitAny: dynamic policy dispatch
      const result = await (policyInstance as any)[handler.method](
        user,
        resource,
        ...(handler.params ?? []),
      );
      if (!result) {
        this.logger.warn(
          `Policy denied: ${handler.policyClass.name}.${handler.method}`,
        );
        throw new ForbiddenException("Access denied by policy");
      }
    }

    return true;
  }
}
