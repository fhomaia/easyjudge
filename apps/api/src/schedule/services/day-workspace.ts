import { randomUUID } from 'crypto';
import {
  EntityManager,
  EntityMetadata,
  FindOperator,
  In,
  Repository,
} from 'typeorm';
import { ScheduleDay } from '../entities/schedule-day.entity';
import { ScheduleResource } from '../entities/schedule-resource.entity';
import { ScheduleEntry } from '../entities/schedule-entry.entity';

// Espaço de trabalho de UM dia do cronograma, em memória (2026-09-28).
//
// Motivo: mover uma apresentação roda as reconciliações de aquecimento/
// intervalos (ScheduleService), que corrigem uma coisa, gravam, releem e
// repetem — ~200 consultas em sequência. Local isso leva ~0,2 s, mas em
// produção cada ida ao banco custa ~40 ms (Render -> Neon) e o mover
// levava 6 a 8 s. Aqui o dia é carregado uma vez (dentro de uma
// transação, com as linhas travadas), as MESMAS funções de reconciliação
// rodam contra estes repositórios em memória, e no fim só a diferença é
// gravada, em até 3 comandos. De quebra o mover fica atômico: erro no
// meio não deixa o cronograma pela metade.
//
// Os repositórios em memória só implementam o que o caminho do mover usa
// (find/findOneBy/save/remove/create/update com igualdade, In e IsNull).
// Qualquer outra chamada lança erro em vez de cair no banco em silêncio,
// porque ler do banco no meio do trabalho devolveria dado desatualizado.

type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;
type Order = Record<string, 'ASC' | 'DESC'>;

function unsupported(name: string, detail: string): never {
  throw new Error(`DayWorkspace(${name}): ${detail} não suportado.`);
}

function matchesValue(name: string, actual: unknown, expected: unknown) {
  if (expected instanceof FindOperator) {
    const op = expected as FindOperator<unknown>;
    switch (op.type) {
      case 'in':
        return (op.value as unknown[]).includes(actual);
      case 'isNull':
        return actual === null || actual === undefined;
      case 'not':
        return !matchesValue(name, actual, op.value);
      default:
        return unsupported(name, `operador "${op.type}"`);
    }
  }
  if (expected === null) return unsupported(name, 'null direto no where');
  if (expected instanceof Date || typeof expected === 'object') {
    return unsupported(name, 'comparação com objeto');
  }
  return actual === expected;
}

function matches(name: string, row: Row, where: Where | undefined) {
  if (!where) return true;
  if (Array.isArray(where)) return unsupported(name, 'where com OR');
  return Object.entries(where).every(
    ([key, expected]) =>
      expected === undefined || matchesValue(name, row[key], expected),
  );
}

function sortRows(rows: Row[], order: Order | undefined): Row[] {
  if (!order) return rows;
  const keys = Object.entries(order);
  return [...rows].sort((a, b) => {
    for (const [key, dir] of keys) {
      const x = a[key] as number | string;
      const y = b[key] as number | string;
      if (x === y) continue;
      const cmp = x < y ? -1 : 1;
      return dir === 'DESC' ? -cmp : cmp;
    }
    return 0;
  });
}

function defaultValue(column: EntityMetadata['columns'][number]): unknown {
  const def: unknown = column.default;
  if (typeof def === 'function') {
    const sql = (def as () => string)();
    return sql === "'[]'" ? [] : undefined;
  }
  if (def !== undefined) return def;
  return column.isNullable ? null : undefined;
}

// Repositório em memória sobre um Map de linhas. `find`/`findOneBy`
// devolvem CÓPIAS (como o TypeORM, que devolve instâncias novas a cada
// consulta) — mudar o objeto devolvido não muda nada até o `save`.
class InMemoryRepository<T extends { id: string }> {
  constructor(
    private readonly name: string,
    private readonly rows: Map<string, Row>,
    private readonly metadata: EntityMetadata,
    private readonly writable: boolean,
    private readonly onRemove?: (id: string) => void,
  ) {}

  private clone(row: Row): T {
    const target = this.metadata.target as { prototype?: object };
    return Object.assign(
      Object.create(target.prototype ?? Object.prototype) as object,
      row,
    ) as T;
  }

  private assertWritable(op: string) {
    if (!this.writable) unsupported(this.name, `${op} (somente leitura)`);
  }

  find(options: { where?: Where; order?: Order } = {}): Promise<T[]> {
    const extra = Object.keys(options).filter(
      (k) => k !== 'where' && k !== 'order',
    );
    if (extra.length > 0)
      unsupported(this.name, `find com ${extra.join(', ')}`);
    const found = [...this.rows.values()].filter((r) =>
      matches(this.name, r, options.where),
    );
    return Promise.resolve(
      sortRows(found, options.order).map((r) => this.clone(r)),
    );
  }

  findOneBy(where: Where): Promise<T | null> {
    const row = [...this.rows.values()].find((r) =>
      matches(this.name, r, where),
    );
    return Promise.resolve(row ? this.clone(row) : null);
  }

  async findOneByOrFail(where: Where): Promise<T> {
    const row = await this.findOneBy(where);
    if (!row) throw new Error(`DayWorkspace(${this.name}): não encontrado.`);
    return row;
  }

  create(data: Partial<T>): T {
    return this.clone({ ...(data as Record<string, unknown>) } as Row);
  }

  // Mesma semântica do `save` do TypeORM: sobrescreve as colunas
  // definidas (undefined é ignorado), insere quando o id não existe, e
  // devolve no próprio objeto o id/defaults/datas gerados.
  save<E extends T | T[]>(input: E): Promise<E> {
    this.assertWritable('save');
    const list = (Array.isArray(input) ? input : [input]) as T[];
    const now = new Date();
    for (const entity of list) {
      const values = entity as unknown as Record<string, unknown>;
      const existing = values.id ? this.rows.get(values.id as string) : null;
      const row: Row = existing ?? { id: '' };
      if (!existing) {
        for (const column of this.metadata.columns) {
          const def = defaultValue(column);
          if (def !== undefined) row[column.propertyName] = def;
        }
        row.createdAt = now;
      }
      for (const column of this.metadata.columns) {
        const value = values[column.propertyName];
        if (value !== undefined) row[column.propertyName] = value;
      }
      if (!row.id) row.id = randomUUID();
      row.updatedAt = now;
      this.rows.set(row.id, row);
      Object.assign(values, row);
    }
    return Promise.resolve(input);
  }

  remove<E extends T | T[]>(input: E): Promise<E> {
    this.assertWritable('remove');
    const list = (Array.isArray(input) ? input : [input]) as T[];
    for (const entity of list) {
      const values = entity as unknown as Record<string, unknown>;
      const id = values.id as string;
      this.rows.delete(id);
      this.onRemove?.(id);
      // Como o TypeORM: a entidade removida perde o id.
      values.id = undefined;
    }
    return Promise.resolve(input);
  }

  // `delete` por critério (sem carregar as entidades antes), como o
  // TypeORM.
  delete(criteria: string | Where): Promise<void> {
    this.assertWritable('delete');
    const where: Where =
      typeof criteria === 'string' ? { id: criteria } : criteria;
    for (const row of [...this.rows.values()]) {
      if (!matches(this.name, row, where)) continue;
      this.rows.delete(row.id);
      this.onRemove?.(row.id);
    }
    return Promise.resolve();
  }

  update(criteria: string | Where, partial: Partial<T>): Promise<void> {
    this.assertWritable('update');
    const where: Where =
      typeof criteria === 'string' ? { id: criteria } : criteria;
    const now = new Date();
    for (const row of this.rows.values()) {
      if (!matches(this.name, row, where)) continue;
      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) row[key] = value;
      }
      row.updatedAt = now;
    }
    return Promise.resolve();
  }
}

// Qualquer método não implementado acima (count, query builder...)
// lança erro na hora, em vez de devolver undefined.
function strict<T extends object>(name: string, target: T): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === 'string' && !(prop in obj)) {
        return () => unsupported(name, `método "${prop}"`);
      }
      return Reflect.get(obj, prop, receiver) as unknown;
    },
  });
}

export class DayWorkspace {
  readonly entriesRepo: Repository<ScheduleEntry>;
  readonly resourcesRepo: Repository<ScheduleResource>;
  readonly daysRepo: Repository<ScheduleDay>;

  private readonly entries = new Map<string, Row>();
  private readonly initial = new Map<string, Row>();
  private readonly entryMetadata: EntityMetadata;

  private constructor(
    readonly dayId: string,
    manager: EntityManager,
    day: ScheduleDay,
    resources: ScheduleResource[],
    entries: ScheduleEntry[],
  ) {
    this.entryMetadata = manager.connection.getMetadata(ScheduleEntry);
    for (const entry of entries) {
      const row = { ...entry } as unknown as Row;
      this.entries.set(row.id, row);
      this.initial.set(row.id, { ...row });
    }
    const days = new Map<string, Row>([[day.id, { ...day }]]);
    const resourceRows = new Map<string, Row>(
      resources.map((r) => [r.id, { ...r }]),
    );
    this.entriesRepo = strict(
      'entries',
      new InMemoryRepository<ScheduleEntry>(
        'entries',
        this.entries,
        this.entryMetadata,
        true,
        // Espelha o ON DELETE SET NULL de linked_entry_id.
        (id) => {
          for (const row of this.entries.values()) {
            if (row.linkedEntryId === id) row.linkedEntryId = null;
          }
        },
      ),
    ) as unknown as Repository<ScheduleEntry>;
    this.resourcesRepo = strict(
      'resources',
      new InMemoryRepository<ScheduleResource>(
        'resources',
        resourceRows,
        manager.connection.getMetadata(ScheduleResource),
        false,
      ),
    ) as unknown as Repository<ScheduleResource>;
    this.daysRepo = strict(
      'days',
      new InMemoryRepository<ScheduleDay>(
        'days',
        days,
        manager.connection.getMetadata(ScheduleDay),
        false,
      ),
    ) as unknown as Repository<ScheduleDay>;
  }

  // Carrega o dia dentro da transação de `manager`. As linhas do dia
  // ficam travadas (FOR UPDATE, em ordem de id pra não dar deadlock entre
  // dois movimentos no mesmo dia) até o commit: outra escrita nelas
  // (desistência, sinalizar evento especial...) espera em vez de ser
  // sobrescrita pelo flush.
  static async load(
    manager: EntityManager,
    day: ScheduleDay,
  ): Promise<DayWorkspace> {
    // Sem ORDER BY de propósito: as reconciliações percorrem os recursos
    // na ordem em que o banco devolve (física), e quando a mesma equipe
    // se apresenta em duas pistas essa ordem decide de que lado entra a
    // espera. Carregar ordenado mudava o resultado em ~10% dos casos
    // testados (2026-09-28); assim o resultado é idêntico ao de antes.
    const resources = await manager.find(ScheduleResource, {
      where: { scheduleDayId: day.id },
    });
    const entries = resources.length
      ? await manager.find(ScheduleEntry, {
          where: { resourceId: In(resources.map((r) => r.id)) },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        })
      : [];
    const resourceOrder = new Map(resources.map((r, i) => [r.id, i]));
    entries.sort(
      (a, b) =>
        (resourceOrder.get(a.resourceId) ?? 0) -
          (resourceOrder.get(b.resourceId) ?? 0) || a.order - b.order,
    );
    return new DayWorkspace(day.id, manager, day, resources, entries);
  }

  // Pares equipe+categoria com apresentação no dia, no estado atual em
  // memória (substitui as consultas do banco de getUnscheduled e
  // validateSchedulablePair, que veriam o dia ainda sem as mudanças).
  presentationPairs(): { teamId: string | null; categoryId: string | null }[] {
    return [...this.entries.values()]
      .filter((row) => row.type === 'presentation')
      .map((row) => ({
        teamId: row.teamId as string | null,
        categoryId: row.categoryId as string | null,
      }));
  }

  // Grava só a diferença entre o estado carregado e o final: um DELETE,
  // um INSERT e um UPDATE (cada um em lote), na transação de `manager`.
  async flush(manager: EntityManager): Promise<void> {
    const columns = this.entryMetadata.columns.filter(
      (c) => !c.isCreateDate && !c.isUpdateDate,
    );
    const toDb = (row: Row) => {
      const out: Record<string, unknown> = {};
      for (const column of columns) {
        const value = row[column.propertyName];
        if (value !== undefined) out[column.databaseName] = value;
      }
      return out;
    };
    const same = (a: unknown, b: unknown) => {
      if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
      }
      if (typeof a === 'object' && a !== null) {
        return JSON.stringify(a) === JSON.stringify(b);
      }
      return a === b;
    };

    const removed = [...this.initial.keys()].filter(
      (id) => !this.entries.has(id),
    );
    const inserted: Row[] = [];
    const updated: Row[] = [];
    const changedColumns = new Set<string>();
    for (const row of this.entries.values()) {
      const before = this.initial.get(row.id);
      if (!before) {
        inserted.push(row);
        continue;
      }
      let changed = false;
      for (const column of columns) {
        if (column.isPrimary) continue;
        const key = column.propertyName;
        if (!same(before[key], row[key])) {
          changedColumns.add(column.databaseName);
          changed = true;
        }
      }
      if (changed) updated.push(row);
    }

    const table = this.entryMetadata.tablePath;
    if (removed.length > 0) {
      await manager.query(
        `DELETE FROM "${table}" WHERE "id" = ANY($1::uuid[])`,
        [removed],
      );
    }
    if (inserted.length > 0) {
      const rows = inserted.map(toDb);
      const names = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const list = names.map((n) => `"${n}"`).join(', ');
      // Uma instrução só: a FK de linked_entry_id entre linhas novas é
      // conferida no fim da instrução, então a ordem das linhas não
      // importa.
      await manager.query(
        `INSERT INTO "${table}" (${list})
         SELECT ${list} FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb)`,
        [JSON.stringify(rows)],
      );
    }
    if (updated.length > 0) {
      const names = [...changedColumns];
      const set = names.map((n) => `"${n}" = r."${n}"`).join(', ');
      const rows = updated.map((row) => {
        const db = toDb(row);
        const out: Record<string, unknown> = { id: row.id };
        for (const n of names) out[n] = db[n] ?? null;
        return out;
      });
      await manager.query(
        `UPDATE "${table}" AS t SET ${set}, "updated_at" = now()
         FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb) AS r
         WHERE t."id" = r."id"`,
        [JSON.stringify(rows)],
      );
    }
  }
}
