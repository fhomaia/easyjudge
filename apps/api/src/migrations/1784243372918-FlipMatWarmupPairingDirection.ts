import { MigrationInterface, QueryRunner } from "typeorm";

// Não é mudança de schema — `paired_resource_id` continua a mesma
// coluna, só inverte quem aponta pra quem: antes a pista apontava pro
// seu aquecimento (1 pista : 1 aquecimento); agora o aquecimento
// aponta pra pista que atende (1 pista : N aquecimentos, já que é
// comum uma pista ter mais de uma área de aquecimento vinculada). Ver
// ScheduleService.getAvailableWarmupResourceForMat.
export class FlipMatWarmupPairingDirection1784243372918 implements MigrationInterface {
    name = 'FlipMatWarmupPairingDirection1784243372918'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "schedule_resources" AS warmup
            SET "paired_resource_id" = mat.id
            FROM "schedule_resources" AS mat
            WHERE mat."paired_resource_id" = warmup.id
              AND mat."supports_presentations" = true
        `);
        await queryRunner.query(`
            UPDATE "schedule_resources"
            SET "paired_resource_id" = NULL
            WHERE "supports_presentations" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "schedule_resources" AS mat
            SET "paired_resource_id" = warmup.id
            FROM "schedule_resources" AS warmup
            WHERE warmup."paired_resource_id" = mat.id
              AND mat."supports_presentations" = true
        `);
        await queryRunner.query(`
            UPDATE "schedule_resources"
            SET "paired_resource_id" = NULL
            WHERE "supports_presentations" = false
        `);
    }

}
