import { useDataSource } from "../../test/setup.integration.js";
import { CartPolicy } from "../auth/policies/cart.policy.js";
import { OrderPolicy } from "../auth/policies/order.policy.js";
import { ProductPolicy } from "../auth/policies/product.policy.js";
import type { Cart, Order, Product } from "../entities/index.js";
import { OrderStatus } from "../entities/order.entity.js";
import { type User, UserRole } from "../entities/user.entity.js";

/**
 * Policies against entities loaded from a real PostgreSQL.
 *
 * Two bugs lived here, and neither was visible to a unit test.
 *
 * **1. `ProductPolicy.canView` branched on `isActive`.** The entity and the
 * column are `isLive`, so the field was always `undefined` and every anonymous
 * visitor was denied every product — a catalogue that is empty to the public.
 * The unit test passed because its fixture declared `isActive` too: policy and
 * fixture agreed with each other and disagreed with the database.
 *
 * **2. No entity exposed its foreign key as a scalar.** `sellerId` existed in
 * the schema but not on the entity, so `product.sellerId ?? product.seller?.id`
 * fell through to the relation — and TypeORM does not load relations unless
 * asked. Every ownership check therefore returned `false` for a plain
 * `findOne`, denying the actual owner. `@RelationId` exposes the FK from the
 * existing join column, so no migration is involved.
 *
 * The unit suite constructs its own objects and so can only ever prove the
 * policy agrees with a fixture. These assertions are about what TypeORM
 * actually hands the policy.
 */
describe("RBAC policies (integration)", () => {
  const asUser = (id: string, role: UserRole): User => ({ id, role }) as User;

  it("exposes sellerId on a plainly-loaded product and honours ownership", async () => {
    const ds = useDataSource();
    const users = ds.getRepository("User");
    const categories = ds.getRepository("Category");
    const products = ds.getRepository("Product");

    const tag = `pol-${Date.now()}`;
    const seller = await users.save(
      users.create({
        email: `${tag}@example.com`,
        name: "Policy Seller",
        passwordHash: "x",
        role: UserRole.SELLER,
      }),
    );
    const category = await categories.save({ name: tag });
    await products.save(
      products.create({
        name: tag,
        price: 9.99,
        seller: { id: seller.id } as never,
        category: { id: (category as { id: string }).id } as never,
      }),
    );

    // No `relations` — this is the ordinary way an application loads a row.
    const product = await products.findOne({ where: { name: tag } });

    expect(product).not.toBeNull();
    // The FK is populated without joining the relation.
    expect((product as unknown as Product).sellerId).toBe(seller.id);
    expect((product as unknown as Product).categoryId).toBe(
      (category as { id: string }).id,
    );

    const policy = new ProductPolicy();
    const owner = asUser(seller.id, UserRole.SELLER);
    const stranger = asUser("someone-else", UserRole.CUSTOMER);
    const admin = asUser("admin", UserRole.ADMIN);

    expect(policy.canEdit(owner, product as never)).toBe(true);
    expect(policy.canEdit(stranger, product as never)).toBe(false);
    expect(policy.canEdit(admin, product as never)).toBe(true);

    // A live product is public — including to somebody not signed in.
    expect(policy.canView(null, product as never)).toBe(true);
    expect(policy.canView(stranger, product as never)).toBe(true);

    // Unpublish it; the public loses access, the owner and admin keep it.
    await products.update({ name: tag }, { isLive: false });
    const draft = await products.findOne({ where: { name: tag } });

    expect(policy.canView(null, draft as never)).toBe(false);
    expect(policy.canView(stranger, draft as never)).toBe(false);
    expect(policy.canView(owner, draft as never)).toBe(true);
    expect(policy.canView(admin, draft as never)).toBe(true);
  });

  it("honours cart ownership without loading the user relation", async () => {
    const ds = useDataSource();
    const users = ds.getRepository("User");
    const carts = ds.getRepository("Cart");

    const tag = `cart-${Date.now()}`;
    const owner = await users.save(
      users.create({
        email: `${tag}@example.com`,
        name: "Cart Owner",
        passwordHash: "x",
        role: UserRole.CUSTOMER,
      }),
    );
    await carts.save(carts.create({ user: { id: owner.id } as never }));

    const cart = await carts.findOne({ where: { user: { id: owner.id } } });
    expect((cart as unknown as Cart).userId).toBe(owner.id);

    const policy = new CartPolicy();
    expect(
      policy.canEdit(asUser(owner.id, UserRole.CUSTOMER), cart as never),
    ).toBe(true);
    expect(
      policy.canEdit(asUser("intruder", UserRole.CUSTOMER), cart as never),
    ).toBe(false);
    expect(policy.canEdit(asUser("admin", UserRole.ADMIN), cart as never)).toBe(
      true,
    );
  });

  it("honours order ownership and status without loading the user relation", async () => {
    const ds = useDataSource();
    const users = ds.getRepository("User");
    const orders = ds.getRepository("Order");

    const tag = `order-${Date.now()}`;
    const owner = await users.save(
      users.create({
        email: `${tag}@example.com`,
        name: "Order Owner",
        passwordHash: "x",
        role: UserRole.CUSTOMER,
      }),
    );
    await orders.save(
      orders.create({
        user: { id: owner.id } as never,
        status: OrderStatus.PENDING,
        totalAmount: 10,
        paymentMethod: "card",
        placedAt: new Date(),
      }),
    );

    const order = await orders.findOne({
      where: { user: { id: owner.id } },
    });
    expect((order as unknown as Order).userId).toBe(owner.id);
    expect((order as unknown as Order).status).toBe(OrderStatus.PENDING);

    const policy = new OrderPolicy();
    const me = asUser(owner.id, UserRole.CUSTOMER);
    expect(policy.canView(me, order as never)).toBe(true);
    expect(policy.canEdit(me, order as never)).toBe(true);
    expect(policy.canCancel(me, order as never)).toBe(true);
    expect(
      policy.canCancel(asUser("intruder", UserRole.CUSTOMER), order as never),
    ).toBe(false);

    // Once it leaves PENDING the owner can no longer edit or cancel it.
    // Update by id. A criteria of `{ status: SHIPPED }` matches nothing while
    // the row is still PENDING, so the update silently no-ops.
    await orders.update(
      { id: (order as unknown as Order).id },
      {
        status: OrderStatus.SHIPPED,
      },
    );
    const shipped = await orders.findOne({
      where: { id: (order as unknown as Order).id },
    });
    expect((shipped as unknown as Order).status).toBe(OrderStatus.SHIPPED);
    expect(policy.canEdit(me, shipped as never)).toBe(false);
    expect(policy.canCancel(me, shipped as never)).toBe(false);
    // …but still sees it.
    expect(policy.canView(me, shipped as never)).toBe(true);
    // …and an admin may still cancel it.
    expect(
      policy.canCancel(asUser("admin", UserRole.ADMIN), shipped as never),
    ).toBe(true);
  });
});
