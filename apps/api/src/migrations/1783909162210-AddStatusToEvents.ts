import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStatusToEvents1783909162210 implements MigrationInterface {
  name = 'AddStatusToEvents1783909162210';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."events_status_enum" AS ENUM('created', 'published', 'started', 'completed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "events" ADD "status" "public"."events_status_enum" NOT NULL DEFAULT 'created'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."events_status_enum"`);
  }
}
