import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Between,
  type FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  QueryFailedError,
  Repository,
} from "typeorm";
import { ProductPolicy } from "../auth/policies/product.policy.js";
import { Category } from "../entities/category.entity.js";
import { Product } from "../entities/product.entity.js";
import type { User } from "../entities/user.entity.js";
import {
  type CategoryResponseDto,
  toCategoryResponse,
} from "./dto/category-response.dto.js";
import type { CreateCategoryDto } from "./dto/create-category.dto.js";
import { CreateProductDto } from "./dto/create-product.dto.js";
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  type ListProductsQueryDto,
} from "./dto/list-products-query.dto.js";
import {
  type PaginatedProductsDto,
  type ProductResponseDto,
  toProductResponse,
} from "./dto/product-response.dto.js";
import { UpdateCategoryDto } from "./dto/update-category.dto.js";
import { UpdateProductDto } from "./dto/update-product.dto.js";

/** PostgreSQL unique-violation. Never matched on the message text. */
const PG_UNIQUE_VIOLATION = "23505";

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly productPolicy: ProductPolicy,
  ) {}

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  /**
   * Public catalogue listing.
   *
   * `isLive: true` is not a filter a caller can turn off. It is set here,
   * unconditionally, *after* the caller's own criteria are collected, so no
   * combination of query parameters can widen a public endpoint into a listing
   * of other sellers' drafts. Soft-deleted rows are excluded for free by
   * TypeORM's default scope — `find`/`findAndCount` append `deletedAt IS NULL`
   * unless `withDeleted` is passed, and nothing here passes it.
   */
  async listProducts(
    query: ListProductsQueryDto = {},
  ): Promise<PaginatedProductsDto> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      if (query.minPrice > query.maxPrice) {
        throw new BadRequestException(
          "minPrice cannot be greater than maxPrice",
        );
      }
    }

    const where: FindOptionsWhere<Product> = { isLive: true };

    // Filtered through the *relation*, not through `categoryId` / `sellerId`.
    // Those are `@RelationId` projections: they are populated on a loaded
    // entity, but TypeORM's find-options builder has no column mapping for
    // them and throws `EntityPropertyNotFoundError: Property "categoryId" was
    // not found in "Product"` if you try. The nested form compiles to the same
    // FK predicate, and it is the only one that runs.
    if (query.categoryId) where.category = { id: query.categoryId };
    if (query.sellerId) where.seller = { id: query.sellerId };

    // `Between` is inclusive on both ends, which is what "between 10 and 20"
    // means to a shopper. Two separate operators on one key would need an
    // AND-group; Between expresses it directly.
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      where.price = Between(query.minPrice, query.maxPrice);
    } else if (query.minPrice !== undefined) {
      where.price = MoreThanOrEqual(query.minPrice);
    } else if (query.maxPrice !== undefined) {
      where.price = LessThanOrEqual(query.maxPrice);
    }

    const search = query.q?.trim();
    if (search) {
      // `%` and `_` are LIKE wildcards. Left unescaped, a search for "50%"
      // silently becomes a wildcard pattern — the user gets a result set that
      // does not match their query and no indication why. Backslash is
      // Postgres' default LIKE escape character, so escaping it too is what
      // makes a literal `\` searchable.
      const escaped = search.replace(/[\\%_]/g, (char) => `\\${char}`);
      where.name = ILike(`%${escaped}%`);
    }

    const [products, total] = await this.productRepository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: products.map(toProductResponse),
      total,
      page,
      limit,
      // Ceiling, not rounding: 3 items at limit 2 is 2 pages, and floor(3/2) is
      // 1 — which hides the third item on a page the client is never shown.
      // The floor is also a guard, not a nicety: total === 0 must report 0
      // pages, not `Math.ceil(0 / limit) === 0` by accident of a `|| 1`
      // that would claim an empty catalogue has one page of results.
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    };
  }

  /**
   * Read one product.
   *
   * `user` is `null` for an anonymous caller. A product that exists but that
   * this caller may not see is reported as **404, not 403** — a 403 confirms
   * the draft exists, which is itself the information the policy withholds.
   * There is no difference to an outsider between "no such product" and
   * "someone else's unpublished product", and the response must not create one.
   */
  async findProductById(
    id: string,
    user: User | null = null,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product || !this.productPolicy.canView(user, product)) {
      throw new NotFoundException("Product not found");
    }

    return toProductResponse(product);
  }

  /**
   * Load a product for a write, without a visibility check.
   *
   * Distinct from `findProductById` on purpose: PATCH and DELETE must be able
   * to say 403 (you are signed in, this is not yours) rather than 404, or every
   * seller gets a "not found" when they mistype an id of their own listing and
   * has no way to tell that from a real one. The write path is authenticated,
   * so leaking existence there is not the disclosure the 404 rule protects.
   */
  private async requireProduct(id: string): Promise<Product> {
    // No `withDeleted`: a soft-deleted row is gone as far as every caller is
    // concerned, and re-editing one would resurrect it into an inconsistent
    // state where `deletedAt` is set but the row is live.
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async createProduct(
    dto: CreateProductDto,
    seller: User,
  ): Promise<ProductResponseDto> {
    const product = this.productRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      imageUrl: dto.imageUrl ?? null,
      isLive: dto.isLive ?? false,
      // The relation, not a `sellerId` field the client chose: `sellerId` is
      // `@RelationId`-derived, so it is populated by a load, never written
      // directly. Setting the relation is what TypeORM turns into the FK.
      seller: { id: seller.id } as User,
      category: dto.categoryId ? ({ id: dto.categoryId } as Category) : null,
    });

    const saved = await this.productRepository.save(product);

    // Re-read rather than return `saved`. `save` echoes back the object it was
    // handed, in which `sellerId` and `categoryId` are still undefined — they
    // are `@RelationId` projections that only a load materialises. Returning
    // `saved` directly would put two `undefined` fields on the response of
    // every freshly created product.
    const reloaded = await this.productRepository.findOne({
      where: { id: saved.id },
    });

    return toProductResponse(reloaded ?? saved);
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    user: User,
  ): Promise<ProductResponseDto> {
    const product = await this.requireProduct(id);

    // `canEdit` reads `product.sellerId`, which `@RelationId` populates from
    // the existing join column with no join in the query — see
    // src/integration/rbac-policies.integration.spec.ts, which exists because
    // a `findOne` that did not load the relation used to fail every ownership
    // check.
    if (!this.productPolicy.canEdit(user, product)) {
      throw new ForbiddenException("Access denied by policy");
    }

    if (dto.name !== undefined) product.name = dto.name;
    if (dto.description !== undefined) product.description = dto.description;
    if (dto.price !== undefined) product.price = dto.price;
    if (dto.imageUrl !== undefined) product.imageUrl = dto.imageUrl;
    if (dto.isLive !== undefined) product.isLive = dto.isLive;

    if (dto.categoryId !== undefined) {
      // Assign the relation, not `product.categoryId`. The latter is a
      // `@RelationId` projection: writing it updates an in-memory property
      // that `save()` has no column to write, and the category silently keeps
      // its old value.
      product.category = dto.categoryId
        ? ({ id: dto.categoryId } as Category)
        : null;
    }

    const saved = await this.productRepository.save(product);
    const reloaded = await this.productRepository.findOne({
      where: { id: saved.id },
    });

    return toProductResponse(reloaded ?? saved);
  }

  /**
   * Soft delete: unpublish, then tombstone.
   *
   * Two writes, in this order, because they answer different questions.
   * `isLive = false` is what stops the product being *served*; `deletedAt` is
   * what stops it being *found*. Setting only `deletedAt` would work today,
   * because TypeORM's default scope hides the row anyway — but a later
   * `withDeleted` report or a raw audit query would still show a live product,
   * and the column a reader looks at first is the one lying.
   */
  async softDeleteProduct(id: string, user: User): Promise<void> {
    const product = await this.requireProduct(id);

    if (!this.productPolicy.canEdit(user, product)) {
      throw new ForbiddenException("Access denied by policy");
    }

    await this.productRepository.update(product.id, { isLive: false });
    await this.productRepository.softDelete(product.id);
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  /** Every category, alphabetical. Not paginated: the set is a taxonomy. */
  async listCategories(): Promise<CategoryResponseDto[]> {
    const categories = await this.categoryRepository.find({
      order: { name: "ASC" },
    });
    return categories.map(toCategoryResponse);
  }

  async findCategoryById(id: string): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });
    if (!category) throw new NotFoundException("Category not found");
    return toCategoryResponse(category);
  }

  async createCategory(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = this.categoryRepository.create({
      name: dto.name,
      description: dto.description ?? null,
    });

    try {
      const saved = await this.categoryRepository.save(category);
      return toCategoryResponse(saved);
    } catch (error) {
      throw this.toUniqueViolation(
        error,
        "A category with that name already exists",
      );
    }
  }

  async updateCategory(
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });
    if (!category) throw new NotFoundException("Category not found");

    if (dto.name !== undefined) category.name = dto.name;
    if (dto.description !== undefined) category.description = dto.description;

    try {
      const saved = await this.categoryRepository.save(category);
      return toCategoryResponse(saved);
    } catch (error) {
      throw this.toUniqueViolation(
        error,
        "A category with that name already exists",
      );
    }
  }

  /**
   * `categories.name` is UNIQUE. Without this the constraint violation escapes
   * as a 500 and the client is told to retry a request that can never succeed.
   */
  private toUniqueViolation(error: unknown, message: string): unknown {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string } | undefined)?.code ===
        PG_UNIQUE_VIOLATION
    ) {
      return new ConflictException(message);
    }
    return error;
  }
}
