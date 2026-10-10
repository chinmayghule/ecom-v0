import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from "typeorm";
import { Category } from "./category.entity.js";
import { User } from "./user.entity.js";

@Entity("products")
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  seller!: User;

  @RelationId((product: Product) => product.seller)
  sellerId!: string;

  @Column()
  name!: string;

  @Column({ nullable: true, type: "text" })
  description: string | null = null;

  @ManyToOne(() => Category, { nullable: true, onDelete: "SET NULL" })
  category: Category | null = null;

  @RelationId((product: Product) => product.category)
  categoryId!: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price!: number;

  @Column({ nullable: true, type: "varchar" })
  imageUrl: string | null = null;

  @Column({ default: true })
  isLive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null = null;
}
