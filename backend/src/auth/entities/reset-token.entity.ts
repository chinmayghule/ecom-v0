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

  @ManyToOne(() => User, { onDelete: "CASCADE" })
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
