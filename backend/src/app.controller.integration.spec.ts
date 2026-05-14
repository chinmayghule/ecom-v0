import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController (integration)", () => {
  let appController: AppController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = module.get<AppController>(AppController);
  });

  it("should return 'Hello World!' (real service)", () => {
    expect(appController.getHello()).toBe("Hello World!");
  });
});
