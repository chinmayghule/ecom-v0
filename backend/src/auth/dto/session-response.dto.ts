import { type DeviceInfo } from "../../entities/session.entity.js";

export class SessionResponseDto {
  id!: string;

  userAgent!: string;

  ipAddress: string | null = null;

  deviceInfo: DeviceInfo | null = null;

  lastActiveAt: Date | null = null;

  createdAt!: Date;
}
