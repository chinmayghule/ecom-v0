import { BadRequestException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

@Injectable()
export class HashService {
  async hashPassword(plain: string): Promise<string> {
    if (!plain) throw new BadRequestException("Password cannot be empty");
    return argon2.hash(plain);
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    if (!hash || !plain)
      throw new BadRequestException("Hash and password are required");
    return argon2.verify(hash, plain);
  }
}
