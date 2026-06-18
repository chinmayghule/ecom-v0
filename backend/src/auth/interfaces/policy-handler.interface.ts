import type { Type } from "@nestjs/common";

export interface PolicyHandler {
  policyClass: Type;
  method: string;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic policy dispatch
  params?: any[];
}
