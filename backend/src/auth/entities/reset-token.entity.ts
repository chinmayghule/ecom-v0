import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("reset_tokens")
export class ResetToken {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column()
  userId!: string;

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
