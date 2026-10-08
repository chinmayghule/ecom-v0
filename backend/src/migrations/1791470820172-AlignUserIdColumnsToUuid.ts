import type { MigrationInterface, QueryRunner } from "typeorm";

export class AlignUserIdColumnsToUuid1791470820172
  implements MigrationInterface
{
  name = "AlignUserIdColumnsToUuid1791470820172";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "login_attempts" ALTER COLUMN "userId" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "login_attempts" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "login_attempts" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" ALTER COLUMN "userId" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" ALTER COLUMN "userId" TYPE uuid USING "userId"::uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" ALTER COLUMN "userId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "login_attempts" ADD CONSTRAINT "FK_c2b446ddee54bbf8f679dafd80a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "login_attempts" DROP CONSTRAINT "FK_c2b446ddee54bbf8f679dafd80a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "login_attempts" ALTER COLUMN "userId" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "reset_tokens" ALTER COLUMN "userId" TYPE character varying`,
    );
  }
}
