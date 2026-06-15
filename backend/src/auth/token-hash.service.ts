import { Injectable } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";

@Injectable()
export class TokenHashService {
  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  compare(token: string, hash: string): boolean {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const bufA = Buffer.from(tokenHash);
    const bufB = Buffer.from(hash);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
