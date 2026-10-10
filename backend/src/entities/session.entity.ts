import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity.js";

export interface DeviceInfo {
  os: string;
  browser: string;
  deviceType: "mobile" | "desktop";
}

@Entity("sessions")
// Every authenticated request looks a session up by its hashed refresh token.
// Added in AddSessionRefreshTokenIndex1791601120000.
@Index("IDX_sessions_refresh_token", ["refreshToken"])
export class Session {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  refreshToken!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @RelationId((e: Session) => e.user)
  userId!: string;

  @Column()
  expiresAt!: Date;

  @Column({ type: "varchar", nullable: true })
  userAgent: string | null = null;

  @Column({ type: "varchar", nullable: true })
  ipAddress: string | null = null;

  @Column({ type: "jsonb", nullable: true })
  deviceInfo: DeviceInfo | null = null;

  @Column({ type: "timestamp", nullable: true })
  lastActiveAt: Date | null = null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
