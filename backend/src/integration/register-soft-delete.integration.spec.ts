import { IsNull } from "typeorm";
import { useDataSource } from "../../test/setup.integration.js";
import { UserRole } from "../entities/user.entity.js";
import { UsersService } from "../users/users.service.js";

/**
 * Registering an address that belongs to a soft-deleted account.
 *
 * `users.email` is UNIQUE and `@DeleteDateColumn` does not relax it — a
 * soft-deleted row keeps occupying its address. `register` used to check with
 * `findByEmail`, which filters `deletedAt IS NULL` and so reported the address
 * as free. The INSERT then hit the constraint and the request failed as a 500
 * rather than a 409.
 *
 * A unit test with a mocked repository cannot see this. The mock returns
 * whatever `findOne` is stubbed to return, so it agrees with the code under
 * test by construction; the distinction only exists in the database.
 */
describe("register with a soft-deleted email (integration)", () => {
  it("sees the tombstone that findByEmail filters out", async () => {
    const ds = useDataSource();
    const users = ds.getRepository("User");
    const email = `reg-${Date.now()}@example.com`;

    await users.save(
      users.create({
        email,
        name: "Original Owner",
        passwordHash: "x",
        role: UserRole.CUSTOMER,
      }),
    );
    // Soft-delete it, as an account-removal flow would.
    await ds
      .getRepository("User")
      .query(`UPDATE "users" SET "deletedAt" = now() WHERE "email" = $1`, [
        email,
      ]);

    // The lookup register used: filters the tombstone out, so it says "free".
    expect(
      await users.findOne({ where: { email, deletedAt: IsNull() } }),
    ).toBeNull();

    // …but the row still holds the address.
    expect(
      await users.findOne({ where: { email }, withDeleted: true }),
    ).not.toBeNull();

    // Which means a raw INSERT — what the old code reached — violates the
    // constraint. This is the 500.
    await expect(
      ds
        .getRepository("User")
        .createQueryBuilder()
        .insert()
        .into("User")
        .values({
          email,
          name: "Impostor",
          passwordHash: "y",
          role: "customer",
        })
        .execute(),
    ).rejects.toThrow();

    // The lookup register now uses finds it, so registration can answer 409.
    const usersService = new UsersService(ds.getRepository("User"));
    expect(
      await usersService.findByEmailIncludingDeleted(email),
    ).not.toBeNull();
    expect(await usersService.findByEmail(email)).toBeNull();
  });

  it("still reports a genuinely unused address as free", async () => {
    const ds = useDataSource();
    const usersService = new UsersService(ds.getRepository("User"));
    expect(
      await usersService.findByEmailIncludingDeleted(
        `definitely-free-${Date.now()}@example.com`,
      ),
    ).toBeNull();
  });
});
