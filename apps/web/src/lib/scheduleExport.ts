import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { FullScheduleItem } from "@/lib/eventFullSchedule";
import { formatMinutes } from "@/lib/scheduleTime";
import { getScheduleEntryDisplay, isAutoWaitBreak } from "@/lib/scheduleEntryDisplay";
import { formatDate } from "@/lib/formatDate";

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .toLowerCase() || "cronograma"
  );
}

interface ExportRow {
  day: string;
  start: string;
  end: string;
  resource: string;
  title: string;
  subtitle: string;
}

// Mesma leitura (título/subtítulo) que a timeline/tabela/consulta ao
// vivo mostram na tela — ver getScheduleEntryDisplay — pra o
// arquivo baixado bater com o que o usuário já vê no navegador.
function buildRows(items: FullScheduleItem[]): ExportRow[] {
  return items.map((item) => {
    const display = getScheduleEntryDisplay(item.entry, item.start, item.end, []);
    return {
      day: formatDate(item.dayDate),
      start: formatMinutes(item.start),
      end: formatMinutes(item.end),
      resource: item.resourceName,
      title: display.title,
      subtitle: display.subtitle ?? "",
    };
  });
}

export function exportScheduleToExcel(eventName: string, items: FullScheduleItem[]): void {
  const rows = buildRows(items);
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Dia: r.day,
      Início: r.start,
      Fim: r.end,
      Pista: r.resource,
      Item: r.title,
      Detalhe: r.subtitle,
    })),
  );
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
    { wch: 18 },
    { wch: 28 },
    { wch: 24 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Cronograma");
  XLSX.writeFile(workbook, `cronograma-${slugify(eventName)}.xlsx`);
}

interface PdfRow {
  start: string;
  stage: string;
  event: string;
  category: string;
  program: string;
}

// O PDF é o material impresso/compartilhado com jurados e equipes — só
// entram itens "de verdade" (apresentação, aquecimento, e os
// componentes do dia: intervalo/almoço, abertura, premiação e demais
// personalizados), sem os intervalos de espera que o backend gera
// sozinho (ex: "Aguardando aquecimento") pra preencher o vão entre uma
// apresentação e o aquecimento dela — ver isAutoWaitBreak. A coluna
// "Categoria" não repete o prefixo "Aquecimento" (que já aparece na
// coluna "Evento"), fica só o nome da categoria em si. `teamPrograms`
// resolve o programa de uma equipe pelo `teamId` — a mesma limitação de
// `filterFullSchedule` (o `ScheduleEntry` não carrega `programId`, só
// `teamId`/`teamName`), então o mapa vem de fora (ver
// EventLiveSchedulePage, que já busca `teamsApi.listForEvent`).
function buildPdfRows(items: FullScheduleItem[], teamPrograms: Map<string, string>): PdfRow[] {
  return items
    .filter((item) => !isAutoWaitBreak(item.entry))
    .map((item) => {
      const { entry } = item;
      const display = getScheduleEntryDisplay(entry, item.start, item.end, []);
      const event = entry.type === "warmup" ? `Aquecimento — ${display.title}` : display.title;
      const category =
        entry.type === "presentation" || entry.type === "warmup" ? (entry.categoryName ?? "") : "";
      const program = entry.teamId ? (teamPrograms.get(entry.teamId) ?? "") : "";
      return {
        start: formatMinutes(item.start),
        stage: item.resourceName,
        event,
        category,
        program,
      };
    });
}

// Dia vira um título separado (não coluna) pra sobrar largura na
// tabela — ver pedido do usuário. Itens já chegam ordenados por
// dia+horário (computeFullSchedule/filterFullSchedule), então agrupar
// preservando a ordem de inserção do Map já basta, sem precisar
// reordenar.
// jspdf-autotable v5 anexa `lastAutoTable` na instância do jsPDF em
// runtime (via applyPlugin), mas os tipos publicados não fazem essa
// augmentation do módulo "jspdf" — sem esse cast o TS não enxerga a
// propriedade.
function getLastAutoTableFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function groupByDay(items: FullScheduleItem[]): Map<string, FullScheduleItem[]> {
  const map = new Map<string, FullScheduleItem[]>();
  for (const item of items) {
    const list = map.get(item.dayDate) ?? [];
    list.push(item);
    map.set(item.dayDate, list);
  }
  return map;
}

export function exportScheduleToPdf(
  eventName: string,
  items: FullScheduleItem[],
  teamPrograms: Map<string, string>,
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`Cronograma — ${eventName}`, margin, margin);

  let cursorY = margin + 20;

  for (const [dayDate, dayItems] of groupByDay(items)) {
    const rows = buildPdfRows(dayItems, teamPrograms);
    if (rows.length === 0) continue;

    // Evita título de dia "órfão" sozinho no fim da página, sem
    // nenhuma linha da própria tabela visível junto.
    if (cursorY + 50 > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(formatDate(dayDate), margin, cursorY);
    doc.setFont("helvetica", "normal");
    cursorY += 10;

    autoTable(doc, {
      startY: cursorY,
      head: [["Início", "Palco", "Evento", "Categoria", "Programa"]],
      body: rows.map((r) => [r.start, r.stage, r.event, r.category, r.program]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [31, 111, 176] },
      alternateRowStyles: { fillColor: [245, 248, 251] },
      margin: { left: margin, right: margin },
    });

    cursorY = getLastAutoTableFinalY(doc) + 24;
  }

  doc.save(`cronograma-${slugify(eventName)}.pdf`);
}
