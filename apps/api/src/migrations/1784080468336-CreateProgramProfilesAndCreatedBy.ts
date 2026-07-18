import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProgramProfilesAndCreatedBy1784080468336 implements MigrationInterface {
  name = 'CreateProgramProfilesAndCreatedBy1784080468336';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "program_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "name" character varying(150) NOT NULL, "contact_email" character varying NOT NULL, "city" character varying(100), "state" character varying(2), "logo_url" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_f539b331bc86eb3a9a1cecb55e" UNIQUE ("user_id"), CONSTRAINT "PK_22b8be6bb07fa2990b8356c17f8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f539b331bc86eb3a9a1cecb55e" ON "program_profiles" ("user_id") `,
    );
    // Nullable no início de propósito — já existem linhas em
    // "programs" (não dá pra adicionar NOT NULL direto sem valor).
    // Backfill usa o criador do evento como melhor palpite (mesmo
    // raciocínio já usado antes pra backfill de EventMember/admin
    // na migration de versionamento de eventos).
    await queryRunner.query(`ALTER TABLE "programs" ADD "created_by_id" uuid`);
    await queryRunner.query(
      `UPDATE "programs" p SET "created_by_id" = e."created_by_id" FROM "events" e WHERE e."id" = p."event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" ALTER COLUMN "created_by_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b44b72ef368c7a57f4777d81b0" ON "programs" ("created_by_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" ADD CONSTRAINT "FK_b44b72ef368c7a57f4777d81b0f" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_profiles" ADD CONSTRAINT "FK_f539b331bc86eb3a9a1cecb55ee" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "program_profiles" DROP CONSTRAINT "FK_f539b331bc86eb3a9a1cecb55ee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" DROP CONSTRAINT "FK_b44b72ef368c7a57f4777d81b0f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b44b72ef368c7a57f4777d81b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "programs" DROP COLUMN "created_by_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f539b331bc86eb3a9a1cecb55e"`,
    );
    await queryRunner.query(`DROP TABLE "program_profiles"`);
  }
}
