import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StorageService } from '../../common/services/storage.service';

const RUN_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_RUN_DELAY_MS = 60 * 1000;

// Limpeza periódica dos documentos (2026-10-06), primeira tarefa agendada
// do projeto (sem lib de agendamento: um setInterval no processo basta, o
// Render Starter não dorme e rodar duas vezes não faz mal):
// 1. documentos enviados a eventos concluídos há mais de 30 dias saem
//    (LGPD: identidade de menores); a biblioteca do atleta fica;
// 2. arquivos privados sem nenhuma referência (biblioteca ou evento), com
//    mais de 1 dia (folga pra um envio em andamento), saem do registro e
//    do armazenamento. Cobre também o que sumiu em cascata (atleta,
//    programa ou evento excluído, conta excluída).
@Injectable()
export class DocumentsCleanupService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DocumentsCleanupService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.DOCUMENTS_CLEANUP === 'off') return;
    this.timers.push(
      setTimeout(() => void this.run(), FIRST_RUN_DELAY_MS),
      setInterval(() => void this.run(), RUN_EVERY_MS),
    );
  }

  onApplicationShutdown() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  async run(): Promise<{ eventDocuments: number; files: number }> {
    try {
      const expired: unknown[] = await this.dataSource.query(
        `DELETE FROM athlete_requirement_documents d
          WHERE EXISTS (
            SELECT 1 FROM events e
             WHERE e.alias_id = d.alias_id
               AND e.completed_at IS NOT NULL
               AND e.completed_at < now() - interval '30 days'
          )
          RETURNING d.id`,
      );
      const orphans: { key: string }[] = await this.dataSource.query(
        `SELECT f.key FROM private_files f
          WHERE f.created_at < now() - interval '1 day'
            AND NOT EXISTS (SELECT 1 FROM user_documents u WHERE u.file_key = f.key)
            AND NOT EXISTS (
              SELECT 1 FROM athlete_requirement_documents d
               WHERE d.file_keys ? f.key
            )
          LIMIT 500`,
      );
      let files = 0;
      for (const { key } of orphans) {
        try {
          await this.storageService.deletePrivate(key);
          await this.dataSource.query(
            `DELETE FROM private_files WHERE key = $1`,
            [key],
          );
          files += 1;
        } catch (err) {
          this.logger.error(`Falha ao apagar arquivo ${key}`, err as Error);
        }
      }
      const eventDocuments = Array.isArray(expired[0])
        ? (expired[0] as unknown[]).length
        : expired.length;
      if (eventDocuments || files) {
        this.logger.log(
          `Limpeza de documentos: ${eventDocuments} de eventos, ${files} arquivos.`,
        );
      }
      return { eventDocuments, files };
    } catch (err) {
      this.logger.error('Falha na limpeza de documentos', err as Error);
      return { eventDocuments: 0, files: 0 };
    }
  }
}
