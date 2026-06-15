import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../entities/user.entity.js";
import { HealthService } from "../health.service.js";

describe("HealthService", () => {
  let healthService: HealthService;
  let repo: Repository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            query: vi.fn(),
          },
        },
      ],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
    repo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it("returns ok when DB is up", async () => {
    vi.mocked(repo.query).mockResolvedValueOnce(undefined);
    vi.mocked(repo.query).mockResolvedValueOnce([]);
    const result = await healthService.check();
    expect(result.status).toBe("ok");
    expect(result.database).toBe("ok");
  });

  it("returns degraded when DB is down", async () => {
    vi.mocked(repo.query).mockRejectedValueOnce(new Error("DB error"));
    const result = await healthService.check();
    expect(result.status).toBe("degraded");
    expect(result.database).toBe("error");
  });

  it("includes expected keys", async () => {
    vi.mocked(repo.query).mockResolvedValueOnce(undefined);
    vi.mocked(repo.query).mockResolvedValueOnce([]);
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
