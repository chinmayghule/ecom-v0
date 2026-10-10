import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator.js";
import { Roles } from "../auth/decorators/roles.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { RolesGuard } from "../auth/guards/roles.guard.js";
import { UserRole } from "../entities/user.entity.js";
import { CatalogService } from "./catalog.service.js";
import { CreateCategoryDto } from "./dto/create-category.dto.js";
import { UpdateCategoryDto } from "./dto/update-category.dto.js";

/**
 * Categories are admin-curated: sellers pick from the taxonomy, they do not
 * extend it. That is what `@Roles(UserRole.ADMIN)` on the writes enforces, and
 * it is why there is no policy object here — the answer is a constant, so a
 * policy class would be an indirection with nothing to decide.
 *
 * See the header comment in `products.controller.ts` for why the product
 * routes check ownership in the service instead of through `PoliciesGuard`.
 */
@Controller("categories")
export class CategoriesController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get()
  async list() {
    return this.catalogService.listCategories();
  }

  @Public()
  @Get(":id")
  async findOne(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.catalogService.findCategoryById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() dto: CreateCategoryDto) {
    return this.catalogService.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(":id")
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.catalogService.updateCategory(id, dto);
  }
}
