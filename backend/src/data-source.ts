import path from "node:path";
import * as dotenv from "dotenv";
import { DataSource } from "typeorm";

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

export default new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [`${__dirname}/**/*.entity.{ts,js}`],
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
  migrationsTableName: "migrations",
});
