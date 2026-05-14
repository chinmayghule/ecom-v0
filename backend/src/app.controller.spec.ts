import { Test } from "@nestjs/testing/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = module.get<AppController>(AppController);
    appService = module.get<AppService>(AppService);
  });

  describe("getHello", () => {
    it("should return the result from this service", () => {
      const mockResult = "Hello World!";
      vi.spyOn(appService, "getHello").mockReturnValue(mockResult);

      expect(appController.getHello()).toBe(mockResult);
      expect(appService.getHello).toHaveBeenCalledOnce();
    });
  });
});
