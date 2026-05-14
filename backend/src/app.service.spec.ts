import { Test, TestingModule } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { AppService } from "./app.service.js";

describe("AppService", () => {
  let appService: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    appService = module.get<AppService>(AppService);
  });

  it("should be defined", () => {
    expect(appService).toBeDefined();
  });

  describe("getHello", () => {
    it("should return 'Hello World!'", () => {
      expect(appService.getHello()).toBe("Hello World!");
    });
  });
});
