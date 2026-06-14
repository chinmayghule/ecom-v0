import type { Type } from "@nestjs/common";

export interface PolicyHandler {
  policyClass: Type<any>;
  method: string;
  params?: any[];
}
