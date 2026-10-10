import type { Category } from "../../entities/category.entity.js";

export class CategoryResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

/** Allow-listed for the same reason as `toProductResponse`. */
export function toCategoryResponse(category: Category): CategoryResponseDto {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? null,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
