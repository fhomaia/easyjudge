import { MigrationInterface, QueryRunner } from 'typeorm';

// Substitui o FK `event_id` (aponta pra `events.id` de uma versão
// específica) por uma coluna `alias_id` sem FK (mesmo padrão já usado
// por `EventMember.aliasId`) em 6 tabelas filhas de evento: categories,
// program_participations, schedule_days, regulations,
// judge_participations, special_role_assignments.
//
// Motivo: `events.id` muda a cada republicação (nova versão, mesmo
// `alias_id`) — endereçar essas tabelas pelo `id` da versão exigia um
// loop de "adoção" em EventsService.publishEvent pra reapontar cada
// linha filha pra nova versão, e um bug real (evento republicado
// aparecendo com 0 categorias/0 programas) mostrou que esse padrão é
// frágil. `alias_id` nunca muda entre versões, então essas tabelas
// passam a ficar "grudadas" no evento certo pra sempre, sem loop de
// adoção nenhum.
//
// ScheduleResource/ScheduleEntry/CriterionJudgeAssignment/Team não têm
// `event_id` próprio (dependem em cascata de scheduleDayId/
// judgeParticipationId/programId) — não fazem parte desta migration,
// migram de graça.
export class AddAliasIdToEventScopedChildEntities1784500200000 implements MigrationInterface {
  name = 'AddAliasIdToEventScopedChildEntities1784500200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- categories ---
    await queryRunner.query(`ALTER TABLE "categories" ADD "alias_id" uuid`);
    await queryRunner.query(`
      UPDATE "categories" c SET "alias_id" = e."alias_id"
      FROM "events" e WHERE c."event_id" = e."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "alias_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_alias_id" ON "categories" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_39c8f73f2fcde968ed18ac99528"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_39c8f73f2fcde968ed18ac9952"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "event_id"`);

    // --- program_participations ---
    await queryRunner.query(
      `ALTER TABLE "program_participations" ADD "alias_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "program_participations" p SET "alias_id" = e."alias_id"
      FROM "events" e WHERE p."event_id" = e."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "program_participations" ALTER COLUMN "alias_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_program_participations_alias_id" ON "program_participations" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_participations" DROP CONSTRAINT "FK_program_participations_event_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_program_participations_event_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_participations" DROP COLUMN "event_id"`,
    );

    // --- schedule_days ---
    await queryRunner.query(`ALTER TABLE "schedule_days" ADD "alias_id" uuid`);
    await queryRunner.query(`
      UPDATE "schedule_days" d SET "alias_id" = e."alias_id"
      FROM "events" e WHERE d."event_id" = e."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ALTER COLUMN "alias_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_schedule_days_alias_id" ON "schedule_days" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD CONSTRAINT "UQ_schedule_days_alias_id_day_index" UNIQUE ("alias_id", "day_index")`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP CONSTRAINT "UQ_6c680708836f207756d0d275d54"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP CONSTRAINT "FK_344a3a879983814901fbde371e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_344a3a879983814901fbde371e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP COLUMN "event_id"`,
    );

    // --- regulations (1:1 com evento — mantém unicidade, agora em alias_id) ---
    await queryRunner.query(`ALTER TABLE "regulations" ADD "alias_id" uuid`);
    await queryRunner.query(`
      UPDATE "regulations" r SET "alias_id" = e."alias_id"
      FROM "events" e WHERE r."event_id" = e."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "regulations" ALTER COLUMN "alias_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_regulations_alias_id_unique" ON "regulations" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP CONSTRAINT "FK_fd245fad4f4345645d57b5e93ab"`,
    );
    // REL_... é uma UNIQUE CONSTRAINT de verdade (gerada pelo antigo
    // @OneToOne), não só um índice — precisa de DROP CONSTRAINT, não
    // DROP INDEX (Postgres recusa dropar o índice que respalda uma
    // constraint diretamente).
    await queryRunner.query(
      `ALTER TABLE "regulations" DROP CONSTRAINT "REL_fd245fad4f4345645d57b5e93a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fd245fad4f4345645d57b5e93a"`,
    );
    await queryRunner.query(`ALTER TABLE "regulations" DROP COLUMN "event_id"`);

    // --- judge_participations ---
    await queryRunner.query(
      `ALTER TABLE "judge_participations" ADD "alias_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "judge_participations" j SET "alias_id" = e."alias_id"
      FROM "events" e WHERE j."event_id" = e."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "judge_participations" ALTER COLUMN "alias_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_judge_participations_alias_id" ON "judge_participations" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "judge_participations" DROP CONSTRAINT "FK_5b21bad120f1e1c1f7ed4f5568d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5b21bad120f1e1c1f7ed4f5568"`,
    );
    await queryRunner.query(
      `ALTER TABLE "judge_participations" DROP COLUMN "event_id"`,
    );

    // --- special_role_assignments ---
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD "alias_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "special_role_assignments" s SET "alias_id" = e."alias_id"
      FROM "events" e WHERE s."event_id" = e."id"
    `);
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ALTER COLUMN "alias_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_special_role_assignments_alias_id" ON "special_role_assignments" ("alias_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "UQ_special_role_assignments_alias_role_resource_judge" UNIQUE ("alias_id", "role", "resource_id", "judge_participation_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "UQ_90eed53496a25a006e9aa7f1618"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "FK_51a841a8a5bc19a7ebcb291c12f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_51a841a8a5bc19a7ebcb291c12"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP COLUMN "event_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // down() é só pra dev local — o backfill de event_id usa sempre a
    // versão ATIVA de cada aliasId (histórico de versões antigas já
    // republicadas se perde, aceitável fora de produção).

    // --- special_role_assignments ---
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD "event_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "special_role_assignments" s SET "event_id" = e."id"
      FROM "events" e WHERE e."alias_id" = s."alias_id" AND e."active" = true
    `);
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ALTER COLUMN "event_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_51a841a8a5bc19a7ebcb291c12" ON "special_role_assignments" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "FK_51a841a8a5bc19a7ebcb291c12f" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" ADD CONSTRAINT "UQ_90eed53496a25a006e9aa7f1618" UNIQUE ("event_id", "role", "resource_id", "judge_participation_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP CONSTRAINT "UQ_special_role_assignments_alias_role_resource_judge"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_special_role_assignments_alias_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "special_role_assignments" DROP COLUMN "alias_id"`,
    );

    // --- judge_participations ---
    await queryRunner.query(
      `ALTER TABLE "judge_participations" ADD "event_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "judge_participations" j SET "event_id" = e."id"
      FROM "events" e WHERE e."alias_id" = j."alias_id" AND e."active" = true
    `);
    await queryRunner.query(
      `ALTER TABLE "judge_participations" ALTER COLUMN "event_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5b21bad120f1e1c1f7ed4f5568" ON "judge_participations" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "judge_participations" ADD CONSTRAINT "FK_5b21bad120f1e1c1f7ed4f5568d" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_judge_participations_alias_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "judge_participations" DROP COLUMN "alias_id"`,
    );

    // --- regulations ---
    await queryRunner.query(`ALTER TABLE "regulations" ADD "event_id" uuid`);
    await queryRunner.query(`
      UPDATE "regulations" r SET "event_id" = e."id"
      FROM "events" e WHERE e."alias_id" = r."alias_id" AND e."active" = true
    `);
    await queryRunner.query(
      `ALTER TABLE "regulations" ALTER COLUMN "event_id" SET NOT NULL`,
    );
    // REL_... era uma UNIQUE CONSTRAINT de verdade (gerada pelo antigo
    // @OneToOne), não só um índice.
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD CONSTRAINT "REL_fd245fad4f4345645d57b5e93a" UNIQUE ("event_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_fd245fad4f4345645d57b5e93a" ON "regulations" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "regulations" ADD CONSTRAINT "FK_fd245fad4f4345645d57b5e93ab" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_regulations_alias_id_unique"`,
    );
    await queryRunner.query(`ALTER TABLE "regulations" DROP COLUMN "alias_id"`);

    // --- schedule_days ---
    await queryRunner.query(`ALTER TABLE "schedule_days" ADD "event_id" uuid`);
    await queryRunner.query(`
      UPDATE "schedule_days" d SET "event_id" = e."id"
      FROM "events" e WHERE e."alias_id" = d."alias_id" AND e."active" = true
    `);
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ALTER COLUMN "event_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_344a3a879983814901fbde371e" ON "schedule_days" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD CONSTRAINT "FK_344a3a879983814901fbde371e7" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" ADD CONSTRAINT "UQ_6c680708836f207756d0d275d54" UNIQUE ("event_id", "day_index")`,
    );
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP CONSTRAINT "UQ_schedule_days_alias_id_day_index"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_schedule_days_alias_id"`);
    await queryRunner.query(
      `ALTER TABLE "schedule_days" DROP COLUMN "alias_id"`,
    );

    // --- program_participations ---
    await queryRunner.query(
      `ALTER TABLE "program_participations" ADD "event_id" uuid`,
    );
    await queryRunner.query(`
      UPDATE "program_participations" p SET "event_id" = e."id"
      FROM "events" e WHERE e."alias_id" = p."alias_id" AND e."active" = true
    `);
    await queryRunner.query(
      `ALTER TABLE "program_participations" ALTER COLUMN "event_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_program_participations_event_id" ON "program_participations" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_participations" ADD CONSTRAINT "FK_program_participations_event_id" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_program_participations_alias_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "program_participations" DROP COLUMN "alias_id"`,
    );

    // --- categories ---
    await queryRunner.query(`ALTER TABLE "categories" ADD "event_id" uuid`);
    await queryRunner.query(`
      UPDATE "categories" c SET "event_id" = e."id"
      FROM "events" e WHERE e."alias_id" = c."alias_id" AND e."active" = true
    `);
    await queryRunner.query(
      `ALTER TABLE "categories" ALTER COLUMN "event_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_39c8f73f2fcde968ed18ac9952" ON "categories" ("event_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_39c8f73f2fcde968ed18ac99528" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_categories_alias_id"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "alias_id"`);
  }
}
