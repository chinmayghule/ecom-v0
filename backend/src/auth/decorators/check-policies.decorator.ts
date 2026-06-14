import { SetMetadata } from "@nestjs/common";
import type { PolicyHandler } from "../interfaces/policy-handler.interface.js";

export const CHECK_POLICIES_KEY = "check_policies";
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
