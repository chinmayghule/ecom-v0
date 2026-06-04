import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionColumns1780560505148 implements MigrationInterface {
  name = "AddSessionColumns1780560505148";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "token" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_acd6ec48b54150b1736d0b454b9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69015e2482e433b6d218ad0faf" ON "reset_tokens" ("userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d9fb418d3a96c3ea9d61978335" ON "reset_tokens" ("token") `,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "userAgent" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "ipAddress" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "sessions" ADD "deviceInfo" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "lastActiveAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "sessions" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP COLUMN "lastActiveAt"`,
    );
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "deviceInfo"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "ipAddress"`);
    await queryRunner.query(`ALTER TABLE "sessions" DROP COLUMN "userAgent"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d9fb418d3a96c3ea9d61978335"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_69015e2482e433b6d218ad0faf"`,
    );
    await queryRunner.query(`DROP TABLE "reset_tokens"`);
  }
}
