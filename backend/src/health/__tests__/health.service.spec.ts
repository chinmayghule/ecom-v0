import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HealthService } from "../health.service.js";

describe("HealthService", () => {
  let healthService: HealthService;
  let dataSource: { query: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const mockQuery = vi.fn();
    dataSource = { query: mockQuery };

    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: getDataSourceToken(),
          useValue: dataSource,
        },
      ],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
  });

  it("returns ok when DB is up", async () => {
    dataSource.query.mockResolvedValueOnce(undefined);
    dataSource.query.mockResolvedValueOnce([]);
    const result = await healthService.check();
    expect(result.status).toBe("ok");
    expect(result.database).toBe("ok");
  });

  it("returns degraded when DB is down", async () => {
    dataSource.query.mockRejectedValueOnce(new Error("DB error"));
    const result = await healthService.check();
    expect(result.status).toBe("degraded");
    expect(result.database).toBe("error");
  });

  it("includes expected keys", async () => {
    dataSource.query.mockResolvedValueOnce(undefined);
    dataSource.query.mockResolvedValueOnce([]);
    const result = await healthService.check();
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("uptime");
    expect(result).toHaveProperty("memory");
    expect(result).toHaveProperty("database");
    expect(result).toHaveProperty("lastMigration");
    expect(result.memory).toHaveProperty("heapUsed");
    expect(result.memory).toHaveProperty("heapTotal");
    expect(result.memory).toHaveProperty("rss");
  });
});
