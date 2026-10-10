import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductPolicy } from "../auth/policies/product.policy.js";
import { Category } from "../entities/category.entity.js";
import { Product } from "../entities/product.entity.js";
import { CatalogService } from "./catalog.service.js";
import { CategoriesController } from "./categories.controller.js";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard.js";
import { ProductsController } from "./products.controller.js";

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category])],
  controllers: [ProductsController, CategoriesController],
  providers: [
    CatalogService,
    OptionalJwtAuthGuard,
    // `AuthModule` provides `ProductPolicy` but does not export it, and this
    // module is not allowed to edit that file. Providing a second instance here
    // is safe because `ProductPolicy` is stateless — `BasePolicy` has no
    // constructor dependencies, so there is no per-instance state for the two to
    // disagree about. If it ever gains dependencies, export it from
    // `AuthModule` instead and inject that.
    ProductPolicy,
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
