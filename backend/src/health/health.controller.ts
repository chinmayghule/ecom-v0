import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Returns 503 when the database check fails, not 200.
   *
   * `HealthService` already reported `status: "degraded"` in the body, but a
   * GET defaults to 200 and nothing overrode it. So an instance that could not
   * reach Postgres answered 200 to every uptime monitor — and this project
   * wires BetterStack, which decides "up" from the status code. The signal a
   * human would read was there; the signal the monitor reads was a lie.
   *
   * The body is still returned on failure, with everything except the status
   * code unchanged, so a monitor can distinguish "database unreachable" from
   * "process not running" and a human can still read the detail.
   *
   * `passthrough: true` keeps Nest's own response handling for the success
   * case, so serialisation and interceptors behave normally.
   */
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const result = await this.healthService.check();
    if (result.status !== "ok") res.status(503);
    return result;
  }
}
