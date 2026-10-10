import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { Cart } from "./cart.entity.js";
import { Product } from "./product.entity.js";

@Entity("cart_items")
export class CartItem {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Cart, { onDelete: "CASCADE" })
  cart!: Cart;

  @RelationId((e: CartItem) => e.cart)
  cartId!: string;

  @ManyToOne(() => Product, { onDelete: "CASCADE" })
  product!: Product;

  @RelationId((e: CartItem) => e.product)
  productId!: string;

  @Column({ default: 1 })
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
