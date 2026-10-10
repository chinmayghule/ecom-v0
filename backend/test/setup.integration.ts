import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataSource } from "typeorm";
import { ResetToken } from "../src/auth/entities/reset-token.entity.js";
import {
  Address,
  Cart,
  CartItem,
  Category,
  Inventory,
  LoginAttempt,
  Order,
  OrderItem,
  Product,
  SellerProfile,
  Session,
  User,
} from "../src/entities/index.js";

/**
 * Boots one real DataSource for the whole integration run.
 *
 * `migrationsRun` applies the schema on start, so the suite exercises the same
 * migration path a fresh deploy would — if a migration cannot apply to an empty
 * database, this file fails at import rather than reporting a false pass.
 */

export const entities = [
  User,
  Product,
  Category,
  Session,
  Address,
  SellerProfile,
  Inventory,
  Cart,
  CartItem,
  LoginAttempt,
  Order,
  OrderItem,
  ResetToken,
];

export function createDataSource(): DataSource {
  return new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST ?? "localhost",
    port: Number(process.env.DATABASE_PORT ?? 5433),
    username: process.env.DATABASE_USER ?? "postgres",
    password: process.env.DATABASE_PASSWORD ?? "postgres",
    database: process.env.DATABASE_NAME ?? "ecommerce_test",
    entities,
    synchronize: false,
    migrationsRun: true,
    // import.meta.url rather than __dirname: the package is ESM. TypeScript
    // accepts __dirname because @types/node declares it globally, so it fails
    // only at runtime.
    migrations: [
      `${path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "migrations", "*.{ts,js}")}`,
    ],
    logging: false,
  });
}

let dataSource: DataSource | undefined;

export function useDataSource(): DataSource {
  if (!dataSource) throw new Error("DataSource not initialised");
  return dataSource;
}

beforeAll(async () => {
  if (process.env.SKIP_INTEGRATION === "true") return;
  dataSource = createDataSource();
  await dataSource.initialize();
});

afterAll(async () => {
  if (dataSource?.isInitialized) await dataSource.destroy();
});
