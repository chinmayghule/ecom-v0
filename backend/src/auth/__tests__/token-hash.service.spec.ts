import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { TokenHashService } from "../token-hash.service.js";

describe("TokenHashService", () => {
  let service: TokenHashService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TokenHashService],
    }).compile();
    service = module.get<TokenHashService>(TokenHashService);
  });

  it("produces deterministic hash", () => {
    const result1 = service.hash("test-token");
    const result2 = service.hash("test-token");
    expect(result1).toBe(result2);
  });

  it("produces 64-character hex string", () => {
    const result = service.hash("test-token");
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("different inputs produce different hashes", () => {
    const result1 = service.hash("token-a");
    const result2 = service.hash("token-b");
    expect(result1).not.toBe(result2);
  });

  it("compare returns true for matching token", () => {
    const hash = service.hash("my-token");
    expect(service.compare("my-token", hash)).toBe(true);
  });

  it("compare returns false for wrong token", () => {
    const hash = service.hash("my-token");
    expect(service.compare("wrong-token", hash)).toBe(false);
  });

  it("compare returns false for different length hashes", () => {
    expect(service.compare("token", "short")).toBe(false);
  });
});
