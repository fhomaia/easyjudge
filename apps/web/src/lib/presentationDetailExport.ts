import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { formatElapsed } from "@/lib/deductionIcons";
import { DEDUCTION_LABELS } from "@/lib/deductionLabels";
import { formatPercent, formatPoints } from "@/lib/formatNumber";
import { sumMaxScores } from "@/lib/scoringSummary";
import type { PresentationDetail } from "@/api/client";

// Súmula PREENCHIDA de uma apresentação (admin/assessor) — mesmo
// conteúdo de PresentationNotesDetail.tsx (resumo, notas por critério
// já com a média quando há mais de um jurado, legalidade/deduções,
// comentários), sem o desenho/sketch (nunca chega em PresentationDetail
// — ver ScoringService.buildPresentationDetail, é visível só pro
// próprio jurado).
//
// Layout com faixa/cartões coloridos + tabelas (jspdf-autotable, mesmo
// padrão já usado em lib/scheduleExport.ts) — diferente do texto
// corrido de lib/scoringTemplateExport.ts (súmula EM BRANCO, pensada
// pra imprimir e preencher à mão): aqui os dados já são reais, então
// vale a pena um resultado mais "documento pronto" — cores da marca
// (ver --soft-primary em index.css), menos espaço em branco, texto
// maior. autoTable cuida da paginação das tabelas de grupo/legalidade
// sozinho (repete o cabeçalho se estourar a página).

export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .toLowerCase() || "sumula"
  );
}

export function presentationDetailPdfFilename(detail: PresentationDetail): string {
  return `sumula-${slugify(detail.presentation.teamName)}-${slugify(detail.presentation.categoryName)}.pdf`;
}

const MARGIN = 40;
// --soft-primary (light theme, index.css) — cor de marca do app.
const BRAND: [number, number, number] = [61, 100, 133];
const BRAND_LIGHT: [number, number, number] = [234, 243, 251];
const RED: [number, number, number] = [185, 40, 40];
const RED_LIGHT: [number, number, number] = [252, 235, 235];
const STRIPE: [number, number, number] = [245, 248, 251];
const MUTED: [number, number, number] = [110, 120, 132];
const INK: [number, number, number] = [30, 33, 38];

// jspdf-autotable v5 anexa `lastAutoTable` na instância do jsPDF em
// runtime, mas os tipos publicados não fazem essa augmentation do
// módulo "jspdf" (mesmo gotcha documentado em lib/scheduleExport.ts).
function getLastAutoTableFinalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// Só monta o documento, não salva — quem chama decide se baixa direto
// (`downloadPresentationDetailPdf`) ou junta vários num zip (ver
// AdminNotesOverview "Baixar todas").
export function buildPresentationDetailPdf(detail: PresentationDetail): jsPDF {
  const totalScore = detail.groups
    .flatMap((g) => g.criteria)
    .reduce((sum, c) => sum + (c.value ?? 0), 0);
  const deductionsTotal = detail.legality
    ? detail.legality.deductions.reduce((sum, d) => sum + d.value, 0)
    : 0;
  const finalResult = totalScore + deductionsTotal;
  const maxScore = sumMaxScores(detail.groups);
  const percentage = maxScore > 0 ? (finalResult / maxScore) * 100 : 0;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  // --- Faixa colorida do cabeçalho ---
  const headerHeight = detail.contestationRequested ? 96 : 80;
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("SÚMULA DE PONTUAÇÃO", pageWidth / 2, 32, { align: "center" });
  doc.setFontSize(14);
  doc.text(detail.presentation.teamName, pageWidth / 2, 52, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(
    `${detail.presentation.categoryName} · ${detail.presentation.resourceName}`,
    pageWidth / 2,
    68,
    { align: "center" },
  );
  if (detail.contestationRequested) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("⚠ CONTESTAÇÃO SOLICITADA", pageWidth / 2, 86, { align: "center" });
  }
  doc.setTextColor(...INK);

  let cursorY = headerHeight + 26;

  // --- Cartões de resumo (mesmos números de ScoringSummary) ---
  const stats: { label: string; value: string }[] = [{ label: "TOTAL", value: `${formatPoints(totalScore)} pts` }];
  if (detail.legality) {
    stats.push({ label: "DEDUÇÕES", value: `${formatPoints(deductionsTotal)} pts` });
  }
  stats.push({ label: "RESULTADO FINAL", value: `${formatPoints(finalResult)} pts` });
  stats.push({ label: "APROVEITAMENTO", value: formatPercent(percentage) });

  const statGap = 10;
  const statHeight = 56;
  const statWidth = (contentWidth - statGap * (stats.length - 1)) / stats.length;
  stats.forEach((stat, index) => {
    const x = MARGIN + index * (statWidth + statGap);
    doc.setFillColor(...BRAND_LIGHT);
    doc.setDrawColor(...BRAND);
    doc.roundedRect(x, cursorY, statWidth, statHeight, 6, 6, "FD");
    doc.setTextColor(...BRAND);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(stat.value, x + statWidth / 2, cursorY + 28, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(stat.label, x + statWidth / 2, cursorY + 43, { align: "center" });
  });
  doc.setTextColor(...INK);
  cursorY += statHeight + 26;

  // --- Um grupo por tabela — cabeçalho colorido com o nome do grupo
  // (colSpan 2, sem 2ª coluna própria), corpo com critério + nota. ---
  for (const group of detail.groups) {
    autoTable(doc, {
      startY: cursorY,
      head: [[{ content: group.name.toUpperCase(), colSpan: 2 }]],
      body: group.criteria.map((c) => [c.name, c.value !== null ? c.value.toFixed(1) : "—"]),
      theme: "grid",
      styles: { fontSize: 10.5, cellPadding: 8, textColor: INK, lineColor: [225, 229, 234] },
      headStyles: { fillColor: BRAND, textColor: 255, fontStyle: "bold", fontSize: 11 },
      columnStyles: { 1: { cellWidth: 90, halign: "right", fontStyle: "bold" } },
      alternateRowStyles: { fillColor: STRIPE },
      margin: { left: MARGIN, right: MARGIN },
    });
    cursorY = getLastAutoTableFinalY(doc) + 20;
  }

  // --- Legalidade — mesmo padrão de tabela, em vermelho ---
  if (detail.legality) {
    const body =
      detail.legality.deductions.length > 0
        ? detail.legality.deductions.map((d) => [
            d.presentationElapsedMs !== null ? formatElapsed(d.presentationElapsedMs) : "--:--",
            DEDUCTION_LABELS[d.type],
          ])
        : [["—", "Nenhuma dedução registrada."]];
    autoTable(doc, {
      startY: cursorY,
      head: [[{ content: "LEGALIDADE", colSpan: 2 }]],
      body,
      theme: "grid",
      styles: { fontSize: 10.5, cellPadding: 8, textColor: INK, lineColor: [225, 229, 234] },
      headStyles: { fillColor: RED, textColor: 255, fontStyle: "bold", fontSize: 11 },
      columnStyles: { 0: { cellWidth: 70 } },
      alternateRowStyles: { fillColor: RED_LIGHT },
      margin: { left: MARGIN, right: MARGIN },
    });
    cursorY = getLastAutoTableFinalY(doc) + 20;
  }

  // --- Notas dos jurados — um cartão por comentário, não texto corrido ---
  const notesWithComment = detail.notes.filter((n) => n.comment);
  if (notesWithComment.length > 0) {
    if (cursorY > MARGIN && cursorY + 24 > pageHeight - MARGIN) {
      doc.addPage();
      cursorY = MARGIN;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text("NOTAS DOS JURADOS", MARGIN, cursorY);
    cursorY += 18;

    for (const note of notesWithComment) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrapped: string[] = doc.splitTextToSize(note.comment, contentWidth - 20);
      const boxHeight = 26 + wrapped.length * 13;
      if (cursorY > MARGIN && cursorY + boxHeight > pageHeight - MARGIN) {
        doc.addPage();
        cursorY = MARGIN;
      }
      doc.setFillColor(...STRIPE);
      doc.setDrawColor(225, 229, 234);
      doc.roundedRect(MARGIN, cursorY, contentWidth, boxHeight, 5, 5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...MUTED);
      doc.text(note.judgeName, MARGIN + 10, cursorY + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(wrapped, MARGIN + 10, cursorY + 31);
      cursorY += boxHeight + 10;
    }
  }

  return doc;
}

export function downloadPresentationDetailPdf(detail: PresentationDetail): void {
  buildPresentationDetailPdf(detail).save(presentationDetailPdfFilename(detail));
}

// "Baixar todas" — um PDF por apresentação, empacotados num único .zip
// (decisão do usuário: zip com PDFs separados, não um PDF gigante com
// todas as apresentações juntas). `details` já vem filtrado por quem
// chama (ex: exclui desistências, que não têm súmula de verdade).
export async function downloadPresentationDetailsAsZip(
  details: PresentationDetail[],
  zipFilename: string,
): Promise<void> {
  const zip = new JSZip();
  // Nomes podem colidir (duas equipes com o mesmo nome em categorias
  // com o mesmo slug, embora raro) — desambiguado só se necessário, pra
  // não sobrescrever uma entrada dentro do zip.
  const usedNames = new Map<string, number>();
  for (const detail of details) {
    const baseName = presentationDetailPdfFilename(detail);
    const count = usedNames.get(baseName) ?? 0;
    usedNames.set(baseName, count + 1);
    const filename = count === 0 ? baseName : baseName.replace(/\.pdf$/, `-${count + 1}.pdf`);
    const blob = buildPresentationDetailPdf(detail).output("blob");
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFilename;
  link.click();
  URL.revokeObjectURL(url);
}
