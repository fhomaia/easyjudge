import { MigrationInterface, QueryRunner } from 'typeorm';

// Duas mudanças em event_members, pro roster de acessos do evento
// (2026-07-19):
// 1. `role` (uma por linha) vira `roles` (array) — uma pessoa pode
//    acumular mais de um papel no mesmo evento.
// 2. `user_id` vira nullable + snapshot `first_name`/`last_name`/
//    `email` — dá pra cadastrar alguém no roster antes de ter conta
//    (convite por nome+email, mesmo padrão de JudgeParticipation/
//    ProgramParticipation). Linhas existentes (todas já com user_id
//    preenchido) são retroativamente preenchidas com os dados atuais
//    de `users`.
export class AddMultiRoleAndInviteFieldsToEventMembers1784500100000 implements MigrationInterface {
  name = 'AddMultiRoleAndInviteFieldsToEventMembers1784500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- 1. role -> roles[] ---
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD "roles" "public"."event_members_role_enum" array`,
    );
    await queryRunner.query(
      `UPDATE "event_members" SET "roles" = ARRAY["role"]::"public"."event_members_role_enum"[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ALTER COLUMN "roles" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "event_members" DROP COLUMN "role"`);

    // --- 2. convite pendente: user_id nullable + snapshot ---
    await queryRunner.query(
      `ALTER TABLE "event_members" ALTER COLUMN "user_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD "first_name" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD "last_name" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD "email" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    // Backfill: todas as linhas existentes já têm user_id preenchido —
    // popula o snapshot com os dados atuais da conta.
    await queryRunner.query(`
      UPDATE "event_members" em
      SET "first_name" = u.first_name, "last_name" = u.last_name, "email" = u.email
      FROM "users" u
      WHERE u.id = em.user_id
    `);

    // --- 3. FK: NO ACTION -> SET NULL (perder a conta não apaga o histórico de acesso) ---
    await queryRunner.query(
      `ALTER TABLE "event_members" DROP CONSTRAINT "FK_d428fa2fcb5c4d17598284064b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD CONSTRAINT "FK_d428fa2fcb5c4d17598284064b8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // --- 4. identidade única por pessoa: reclamada (user_id) ou pendente (email) ---
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_event_members_alias_user_unique" ON "event_members" ("alias_id", "user_id") WHERE "user_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_event_members_alias_email_unique" ON "event_members" ("alias_id", LOWER("email")) WHERE "user_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_event_members_email" ON "event_members" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_event_members_email"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_members_alias_email_unique"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_event_members_alias_user_unique"`,
    );

    await queryRunner.query(
      `ALTER TABLE "event_members" DROP CONSTRAINT "FK_d428fa2fcb5c4d17598284064b8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ADD CONSTRAINT "FK_d428fa2fcb5c4d17598284064b8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "event_members" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(`ALTER TABLE "event_members" DROP COLUMN "email"`);
    await queryRunner.query(
      `ALTER TABLE "event_members" DROP COLUMN "last_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" DROP COLUMN "first_name"`,
    );
    // Linhas sem user_id (convites pendentes criados depois desta
    // migration) não têm como voltar pra um "role" singular válido —
    // aceitável, down() é só pra desenvolvimento local.
    await queryRunner.query(
      `DELETE FROM "event_members" WHERE "user_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "event_members" ALTER COLUMN "user_id" SET NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "event_members" ADD "role" "public"."event_members_role_enum"`,
    );
    await queryRunner.query(`UPDATE "event_members" SET "role" = "roles"[1]`);
    await queryRunner.query(
      `ALTER TABLE "event_members" ALTER COLUMN "role" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "event_members" DROP COLUMN "roles"`);
  }
}
