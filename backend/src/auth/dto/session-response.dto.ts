export class SessionResponseDto {
  id!: string;

  userAgent!: string;

  ipAddress: string | null = null;

  deviceInfo: Record<string, any> | null = null;

  lastActiveAt: Date | null = null;

  createdAt!: Date;
}
