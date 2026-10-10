import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthController } from "../health.controller.js";
import { HealthService } from "../health.service.js";

/**
 * The health endpoint's HTTP status, which is the only part an uptime monitor
 * looks at.
 *
 * The service already reported `status: "degraded"` in the body. The controller
 * returned 200 regardless — so an instance that could not reach Postgres
 * answered 200, and the BetterStack monitor wired up in Phase 1 recorded it as
 * healthy. These tests pin the status code, which is the part that was wrong.
 */
describe("HealthController", () => {
  let controller: HealthController;
  const res = { status: vi.fn() };
  const makeRes = () => {
    res.status.mockClear();
    return res;
  };

  const healthService = (status: string) => ({
    check: async () => ({ status }),
  });

  async function build(status: string) {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService(status) }],
    }).compile();
    controller = module.get(HealthController);
  }

  beforeEach(() => makeRes());

  it("returns 200 and does not override the status when healthy", async () => {
    await build("ok");
    const r = makeRes();
    const body = await controller.check(r as never);
    expect(res.status).not.toHaveBeenCalled();
    expect(body.status).toBe("ok");
  });

  it("returns 503 when the database is unreachable", async () => {
    await build("degraded");
    const r = makeRes();
    const body = await controller.check(r as never);
    expect(res.status).toHaveBeenCalledWith(503);
    // The detail is still in the body — a monitor can tell "database down"
    // from "process gone".
    expect(body.status).toBe("degraded");
  });
});
