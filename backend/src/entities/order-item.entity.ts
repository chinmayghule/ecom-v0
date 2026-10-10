import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { Order } from "./order.entity.js";
import { Product } from "./product.entity.js";

@Entity("order_items")
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  order!: Order;

  @RelationId((e: OrderItem) => e.order)
  orderId!: string;

  @ManyToOne(() => Product, { onDelete: "SET NULL", nullable: true })
  product: Product | null = null;

  @RelationId((e: OrderItem) => e.product)
  productId!: string | null;

  @Column()
  productName!: string;

  @Column({ nullable: true, type: "varchar" })
  category: string | null = null;

  @Column()
  quantity!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  unitPrice!: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalPrice!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
