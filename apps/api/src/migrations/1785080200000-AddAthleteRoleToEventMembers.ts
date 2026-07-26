import { MigrationInterface, QueryRunner } from 'typeorm';

// Mesmo padrão de AddProgramRoleToEventMembers.
export class AddAthleteRoleToEventMembers1785080200000 implements MigrationInterface {
  name = 'AddAthleteRoleToEventMembers1785080200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_members_role_enum" ADD VALUE 'athlete'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "event_members" SET "roles" = array_remove("roles", 'athlete'::"public"."event_members_role_enum") WHERE 'athlete' = ANY("roles")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."event_members_role_enum" RENAME TO "event_members_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_members_role_enum" AS ENUM('admin', 'judge', 'assessor', 'spectator', 'program')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ALTER COLUMN "roles" TYPE "public"."event_members_role_enum"[] USING "roles"::"text"::"public"."event_members_role_enum"[]`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_members_role_enum_old"`);
  }
}
