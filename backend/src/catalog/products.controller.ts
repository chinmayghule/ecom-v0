import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { User, UserRole } from "../entities/user.entity.js";
import { CatalogService } from "./catalog.service.js";
import { CreateProductDto } from "./dto/create-product.dto.js";
import { ListProductsQueryDto } from "./dto/list-products-query.dto.js";
import { UpdateProductDto } from "./dto/update-product.dto.js";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard.js";

/**
 * Authorization on this controller happens in `CatalogService`, against the
 * same `ProductPolicy` the rest of the app uses.
 *
 * `@CheckPolicies(ProductPolicy, "canEdit")` was the obvious choice and is not
 * usable here. `PoliciesGuard` reads its subject from `request.resource`, and
 * nothing in this codebase ever writes to it — there is no interceptor, no
 * param decorator, no middleware. The two mechanisms that could populate it
 * both run *after* guards in the Nest lifecycle:
 *
 *   middleware -> guards -> interceptors -> pipes -> route handler
 *
 * A `createParamDecorator` resolves inside the handler argument list, i.e.
 * after `PoliciesGuard` has already run and already called
 * `canEdit(user, undefined)`. That does not merely fail to check — it throws
 * `TypeError: Cannot read properties of undefined (reading 'sellerId')` on a
 * non-admin caller and returns a 500, so the guard appears to work while
 * denying everything. An interceptor has exactly the same ordering problem.
 *
 * The two ways out are both worse than the check-in-service: middleware would
 * mean a second, unauditable load of every product before the route runs, and
 * registering `PoliciesGuard` globally would mean editing `app.module.ts`
 * beyond adding this module — at which point `request.resource` is still unset
 * for every controller in the project and the guard 500s on all of them.
 *
 * So the policy call lives in the service, beside the query that produced the
 * subject. Same `ProductPolicy`, same decision, no ordering hazard. The cost is
 * that `@CheckPolicies` does not appear in the handler metadata, which is worth
 * knowing before someone greps for it.
 *
 * Note that no guard here is registered globally — `app.module.ts` binds only
 * `ThrottlerGuard` — so authentication is opt-in per route via
 * `@UseGuards(JwtAuthGuard)`. `@Public()` below marks intent for the day a
 * global JWT guard does land; today it is documentation, not enforcement.
 */
@Controller("products")
export class ProductsController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  async list(@Query() query: ListProductsQueryDto) {
    return this.catalogService.listProducts(query);
  }

  /**
   * Public, but `@Public()` does not mean "anonymous": `OptionalJwtAuthGuard`
   * resolves the token if one is there so the owner of a draft can read it.
   */
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get(":id")
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User | undefined,
  ) {
    return this.catalogService.findProductById(id, user ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: User) {
    // `sellerId` comes from the verified token, never from the body. A DTO
    // field here would be an ownership forgery waiting to happen.
    return this.catalogService.createProduct(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Patch(":id")
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.catalogService.updateProduct(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN)
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.catalogService.softDeleteProduct(id, user);
  }
}
