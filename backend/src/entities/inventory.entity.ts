import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { Product } from "./product.entity.js";

@Entity("inventory")
export class Inventory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToOne(() => Product, { onDelete: "CASCADE" })
  @JoinColumn()
  product!: Product;

  @RelationId((e: Inventory) => e.product)
  productId!: string;

  @Column({ default: 0 })
  quantity!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
