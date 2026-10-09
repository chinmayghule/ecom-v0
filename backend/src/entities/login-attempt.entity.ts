import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./user.entity.js";

/**
 * One row per lockout identifier.
 *
 * The row is keyed on `identifier` — a SHA-256 hash of the normalised email —
 * rather than on `userId`, because most of the login attempts worth counting
 * come from addresses that have no user row at all. Keying on `userId` meant
 * an unknown email produced no lockout record at all, leaving credential
 * stuffing across a leaked address list bounded only by the global rate limit.
 *
 * `userId` is nullable and kept for cascade cleanup: when a real account is
 * deleted its attempts go with it. It is not the key.
 */
@Entity("login_attempts")
@Index("IDX_login_attempts_identifier", ["identifier"], { unique: true })
export class LoginAttempt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64 })
  identifier!: string;

  @Index()
  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: true })
  user: User | null = null;

  @Column({ default: 0 })
  failedAttempts!: number;

  @Column({ type: "timestamptz", nullable: true })
  lockedUntil: Date | null = null;

  /**
   * Sliding window anchor. The previous implementation compared against
   * `createdAt`, so the window ran from the first failure rather than the most
   * recent one — four failures spread across an hour reset the counter on the
   * fifth instead of locking.
   */
  @Column({ type: "timestamptz" })
  lastAttemptAt!: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
