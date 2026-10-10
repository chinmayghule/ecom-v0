import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { Address } from "./address.entity.js";
import { User } from "./user.entity.js";

export enum OrderStatus {
  PENDING = "pending",
  PAID = "paid",
  SHIPPED = "shipped",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

@Entity("orders")
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  user!: User;

  @RelationId((e: Order) => e.user)
  userId!: string;

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalAmount!: number;

  @Column()
  paymentMethod!: string;

  @ManyToOne(() => Address, { onDelete: "SET NULL", nullable: true })
  shippingAddress: Address | null = null;

  @RelationId((e: Order) => e.shippingAddress)
  shippingAddressId!: string | null;

  @Column()
  placedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
