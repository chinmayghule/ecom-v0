import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../entities/user.entity.js";

@Entity("reset_tokens")
export class ResetToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /**
   * A reset token is only ever minted for an existing account, so this is
   * explicitly non-nullable and indexed. TypeORM defaults `@ManyToOne` to
   * nullable, which silently dropped both the NOT NULL and the index when the
   * baseline was regenerated — the column would then hold NULL for no valid
   * reason while every lookup that joins on it seq-scanned.
   */
  @Index()
  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: false })
  user!: User;

  @Index()
  @Column()
  token!: string;

  @Column()
  expiresAt!: Date;

  @Column({ nullable: true, type: "timestamp" })
  usedAt: Date | null = null;

  @CreateDateColumn()
  createdAt!: Date;
}
