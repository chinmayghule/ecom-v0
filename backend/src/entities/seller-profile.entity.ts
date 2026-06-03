import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Address } from "./address.entity.js";
import { User } from "./user.entity.js";

@Entity("seller_profiles")
export class SellerProfile {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn()
  user!: User;

  @Column()
  storeName!: string;

  @Column({ nullable: true, type: "text" })
  storeDescription: string | null = null;

  @Column({ nullable: true, type: "varchar" })
  email: string | null = null;

  @Column({ nullable: true, type: "varchar" })
  contactNumber: string | null = null;

  @ManyToOne(() => Address, { nullable: true, onDelete: "SET NULL" })
  originAddress: Address | null = null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null = null;
}
