import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("login_attempts")
export class LoginAttempt {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Column({ default: 0 })
  failedAttempts!: number;

  @Column({ type: "timestamp", nullable: true })
  lockedUntil: Date | null = null;

  @CreateDateColumn()
  createdAt!: Date;
}
