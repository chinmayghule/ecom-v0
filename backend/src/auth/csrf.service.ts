import { Injectable } from "@nestjs/common";
import { doubleCsrf } from "csrf-csrf";
import type { Request, Response } from "express";

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? "change-me-in-production",
  getSessionIdentifier: (req) => req.cookies?.refreshToken ?? req.ip,
  cookieName: "__Host-psifi.x-csrf-token",
  cookieOptions: {
    sameSite: "strict",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  },
  size: 32,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  getCsrfTokenFromRequest: (req) => req.headers["x-csrf-token"],
});

export { doubleCsrfProtection };

@Injectable()
export class CsrfService {
  generateToken(req: Request, res: Response): string {
    return generateCsrfToken(req, res);
  }
}
