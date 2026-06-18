import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLoginAttemptsTable1781592921097
  implements MigrationInterface
{
  name = "CreateLoginAttemptsTable1781592921097";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "login_attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "failedAttempts" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_070e613c8f768b1a70742705c5b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c2b446ddee54bbf8f679dafd80" ON "login_attempts" ("userId") `,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_69015e2482e433b6d218ad0faf"`,
    );
    await queryRunner.query(`ALTER TABLE "reset_tokens" DROP COLUMN "userId"`);
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" ADD "userId" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69015e2482e433b6d218ad0faf" ON "reset_tokens" ("userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" ADD CONSTRAINT "FK_69015e2482e433b6d218ad0faf6" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" DROP CONSTRAINT "FK_69015e2482e433b6d218ad0faf6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_69015e2482e433b6d218ad0faf"`,
    );
    await queryRunner.query(`ALTER TABLE "reset_tokens" DROP COLUMN "userId"`);
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" ADD "userId" character varying NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69015e2482e433b6d218ad0faf" ON "reset_tokens" ("userId") `,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c2b446ddee54bbf8f679dafd80"`,
    );
    await queryRunner.query(`DROP TABLE "login_attempts"`);
  }
}
