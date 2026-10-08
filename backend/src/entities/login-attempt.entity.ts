import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity.js";

@Entity("login_attempts")
export class LoginAttempt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column({ default: 0 })
  failedAttempts!: number;

  @Column({ type: "timestamptz", nullable: true })
  lockedUntil: Date | null = null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
