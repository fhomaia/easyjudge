import { MigrationInterface, QueryRunner } from 'typeorm';

// Postgres não tem "DROP VALUE" de enum, então o down() recria o tipo
// do zero (rename -> create -> cast -> drop), mesmo padrão já usado em
// migrations anteriores de troca de enum de role (ver
// RenameGymRoleToProgram/AddGymRoleToUsers).
export class AddProgramRoleToEventMembers1784998385017 implements MigrationInterface {
  name = 'AddProgramRoleToEventMembers1784998385017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."event_members_role_enum" ADD VALUE 'program'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Precisa tirar 'program' de qualquer roles[] existente ANTES de
    // trocar o tipo, senão o cast final falha (a coluna passaria a não
    // aceitar mais esse valor).
    await queryRunner.query(
      `UPDATE "event_members" SET "roles" = array_remove("roles", 'program'::"public"."event_members_role_enum") WHERE 'program' = ANY("roles")`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."event_members_role_enum" RENAME TO "event_members_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."event_members_role_enum" AS ENUM('admin', 'judge', 'assessor', 'spectator')`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ALTER COLUMN "roles" TYPE "public"."event_members_role_enum"[] USING "roles"::"text"::"public"."event_members_role_enum"[]`,
    );
    await queryRunner.query(`DROP TYPE "public"."event_members_role_enum_old"`);
  }
}
