import path from "node:path";
import * as dotenv from "dotenv";
import { DataSource } from "typeorm";

dotenv.config({
  path: [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ],
});

export default new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [`${process.cwd()}/src/**/*.entity.{ts,js}`],
  migrations: [`${process.cwd()}/src/migrations/*.{ts,js}`],
  migrationsTableName: "migrations",
});
