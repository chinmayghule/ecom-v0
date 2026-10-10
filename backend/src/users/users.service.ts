import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { User, UserRole } from "../entities/user.entity.js";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email, deletedAt: IsNull() },
    });
  }

  /**
   * Like `findByEmail`, but includes soft-deleted rows.
   *
   * `users.email` carries a UNIQUE constraint that TypeORM's `@DeleteDateColumn`
   * does not relax — a soft-deleted row keeps occupying its address. So
   * `findByEmail` reports "free" for an address that is in fact still taken,
   * and the subsequent INSERT trips the constraint. Registration must therefore
   * ask this question, not the other one.
   */
  async findByEmailIncludingDeleted(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      withDeleted: true,
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    role?: UserRole;
  }): Promise<User> {
    const user = this.usersRepository.create({
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name ?? data.email.split("@")[0],
      role: data.role ?? UserRole.CUSTOMER,
    });
    return this.usersRepository.save(user);
  }

  async update(
    id: string,
    data: Partial<Pick<User, "name" | "contactNumber" | "passwordHash">>,
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException("User not found");
    Object.assign(user, data);
    return this.usersRepository.save(user);
  }

  async softDelete(id: string): Promise<void> {
    await this.usersRepository.softDelete(id);
  }
}
