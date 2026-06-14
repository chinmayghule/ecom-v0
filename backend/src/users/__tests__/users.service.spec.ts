import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User, UserRole } from "../../entities/user.entity.js";
import { UsersService } from "../users.service.js";

const mockUser = (overrides: Partial<User> = {}): User =>
  ({
    id: "user-1",
    email: "test@example.com",
    passwordHash: "hashed_password",
    name: "Test User",
    role: UserRole.CUSTOMER,
    contactNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }) as User;

describe("UsersService", () => {
  let service: UsersService;
  let repo: Repository<User>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            softDelete: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  describe("findByEmail", () => {
    it("returns user when found", async () => {
      const user = mockUser();
      vi.mocked(repo.findOne).mockResolvedValue(user);

      const result = await service.findByEmail("test@example.com");

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        withDeleted: true,
      });
      expect(result).toEqual(user);
    });

    it("returns null when email not found", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      const result = await service.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });

    it("includes soft-deleted users in search", async () => {
      const deletedUser = mockUser({ deletedAt: new Date() });
      vi.mocked(repo.findOne).mockResolvedValue(deletedUser);

      const result = await service.findByEmail("deleted@example.com");

      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ withDeleted: true }),
      );
      expect(result).toEqual(deletedUser);
    });
  });

  describe("findById", () => {
    it("returns user when found", async () => {
      const user = mockUser();
      vi.mocked(repo.findOne).mockResolvedValue(user);

      const result = await service.findById("user-1");

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: "user-1" },
        withDeleted: true,
      });
      expect(result).toEqual(user);
    });

    it("returns null when user not found", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    const createData = {
      email: "new@example.com",
      passwordHash: "hashed_new",
    };

    it("creates user with all provided fields", async () => {
      const user = mockUser({ email: "new@example.com", name: "Jane" });
      vi.mocked(repo.create).mockReturnValue(user);
      vi.mocked(repo.save).mockResolvedValue(user);

      const result = await service.create({
        ...createData,
        name: "Jane",
        role: UserRole.SELLER,
      });

      expect(repo.create).toHaveBeenCalledWith({
        email: "new@example.com",
        passwordHash: "hashed_new",
        name: "Jane",
        role: UserRole.SELLER,
      });
      expect(repo.save).toHaveBeenCalledWith(user);
      expect(result).toEqual(user);
    });

    it("defaults name from email when not provided", async () => {
      const user = mockUser({ name: "new" });
      vi.mocked(repo.create).mockImplementation(
        (data) => ({ ...user, ...data }) as User,
      );
      vi.mocked(repo.save).mockImplementation(async (u) => u as User);

      const result = await service.create(createData);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: "new" }),
      );
      expect(result.name).toBe("new");
    });

    it("defaults role to CUSTOMER when not provided", async () => {
      vi.mocked(repo.create).mockImplementation(
        (data) => mockUser({ ...data, role: UserRole.CUSTOMER }) as User,
      );
      vi.mocked(repo.save).mockImplementation(async (u) => u as User);

      const result = await service.create(createData);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.CUSTOMER }),
      );
      expect(result.role).toBe(UserRole.CUSTOMER);
    });
  });

  describe("update", () => {
    it("updates user fields", async () => {
      const user = mockUser();
      vi.mocked(repo.findOne).mockResolvedValue(user);
      vi.mocked(repo.save).mockResolvedValue({ ...user, name: "Updated" });

      const result = await service.update("user-1", { name: "Updated" });

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: "user-1" },
        withDeleted: true,
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated" }),
      );
      expect(result.name).toBe("Updated");
    });

    it("throws NotFoundException when user does not exist", async () => {
      vi.mocked(repo.findOne).mockResolvedValue(null);

      await expect(
        service.update("nonexistent", { name: "Ghost" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("softDelete", () => {
    it("calls softDelete on the repository", async () => {
      vi.mocked(repo.softDelete).mockResolvedValue({ affected: 1, raw: {} });

      await service.softDelete("user-1");

      expect(repo.softDelete).toHaveBeenCalledWith("user-1");
    });
  });
});
