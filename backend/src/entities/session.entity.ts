import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity.js";

export interface DeviceInfo {
  os: string;
  browser: string;
  deviceType: "mobile" | "desktop";
}

@Entity("sessions")
export class Session {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  refreshToken!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

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
