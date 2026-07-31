import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { ScoringCriterion, ScoringTemplate } from "@/api/client";

function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "")
      .toLowerCase() || "sumula"
  );
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

interface SheetRow {
  isGroup: boolean;
  name: string;
  maxScore: number | null;
  description: string | null;
}

// Achata a árvore (parentId/type) na ordem em que já aparece no builder
// (`order` por irmão) — um grupo vira uma linha de seção sem valor,
// seguida pelos critérios-folha (`score_item`) com o valor máximo.
function buildRows(criteria: ScoringCriterion[]): SheetRow[] {
  const byParent = new Map<string | null, ScoringCriterion[]>();
  for (const criterion of criteria) {
    const list = byParent.get(criterion.parentId) ?? [];
    list.push(criterion);
    byParent.set(criterion.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order);

  const rows: SheetRow[] = [];
  function walk(parentId: string | null) {
    for (const node of byParent.get(parentId) ?? []) {
      if (node.type === "group") {
        rows.push({ isGroup: true, name: node.name, maxScore: null, description: node.description });
        walk(node.id);
      } else {
        rows.push({
          isGroup: false,
          name: node.name,
          maxScore: node.maxScore,
          description: node.description,
        });
      }
    }
  }
  walk(null);
  return rows;
}

export function exportScoringTemplateToExcel(
  template: ScoringTemplate,
  criteria: ScoringCriterion[],
): void {
  const rows = buildRows(criteria);
  const data = rows.map((row) => ({
    Critério: row.isGroup ? row.name.toUpperCase() : `  ${row.name}`,
    "Valor Máximo": row.isGroup ? "" : row.maxScore,
    Nota: "",
    Descrição: row.description ?? "",
  }));
  data.push({ Critério: "TOTAL", "Valor Máximo": template.targetScore, Nota: "", Descrição: "" });

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet["!cols"] = [{ wch: 42 }, { wch: 14 }, { wch: 10 }, { wch: 60 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Súmula");
  XLSX.writeFile(workbook, `sumula-${slugify(template.name)}.xlsx`);
}

// --- PDF ---
//
// Layout em texto corrido (sem tabela/grade), inspirado numa súmula de
// referência trazida pelo usuário: cada critério é um bloco
// "NOME    X pts ______" seguido da descrição (se houver), em vez de
// linhas de tabela com célula em branco. Grupos viram só um cabeçalho
// em negrito introduzindo os critérios abaixo (indentados) — não têm
// "pts"/linha em branco própria, já que quem recebe nota é sempre o
// item de avaliação (folha), nunca o grupo.
interface LayoutNode {
  isGroup: boolean;
  name: string;
  maxScore: number | null;
  description: string | null;
  children: LayoutNode[];
}

function buildTree(criteria: ScoringCriterion[]): LayoutNode[] {
  const byParent = new Map<string | null, ScoringCriterion[]>();
  for (const criterion of criteria) {
    const list = byParent.get(criterion.parentId) ?? [];
    list.push(criterion);
    byParent.set(criterion.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order);

  function toNode(criterion: ScoringCriterion): LayoutNode {
    return {
      isGroup: criterion.type === "group",
      name: criterion.name,
      maxScore: criterion.maxScore,
      description: criterion.description,
      children: (byParent.get(criterion.id) ?? []).map(toNode),
    };
  }

  return (byParent.get(null) ?? []).map(toNode);
}

const MARGIN = 40;
const HEADING_FONT_SIZE = 10;
const DESC_FONT_SIZE = 8.5;
const HEADING_LINE_HEIGHT = 15;
const DESC_LINE_HEIGHT = 11;
const LEAF_GAP_AFTER = 10;
// Espaço extra entre um critério-raiz (grupo com subárvore inteira, ou
// item de avaliação solto) e o próximo — a pedido do usuário, marca
// visualmente a divisão entre grupos diferentes, já que aqui não há
// mais grade/cor de fundo de tabela pra fazer esse papel.
const SECTION_GAP = 20;
const INDENT_STEP = 14;

// Mede (dryRun=true, sem desenhar) ou desenha (dryRun=false) um nó —
// mesma função pros dois casos garante que a altura calculada bate
// exatamente com o que é desenhado depois. Retorna o Y final após o nó
// (e toda a subárvore, se for grupo).
function layoutNode(
  doc: jsPDF,
  node: LayoutNode,
  depth: number,
  y: number,
  pageWidth: number,
  draw: boolean,
): number {
  const x = MARGIN + depth * INDENT_STEP;
  const rightX = pageWidth - MARGIN;
  let cursorY = y;

  if (node.isGroup) {
    if (draw) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(HEADING_FONT_SIZE);
      doc.text(node.name.toUpperCase(), x, cursorY);
    }
    cursorY += HEADING_LINE_HEIGHT;
    for (const child of node.children) {
      cursorY = layoutNode(doc, child, depth + 1, cursorY, pageWidth, draw);
    }
    return cursorY;
  }

  if (draw) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(HEADING_FONT_SIZE);
    doc.text(node.name, x, cursorY);
    doc.setFont("helvetica", "normal");
    doc.text(`${formatScore(node.maxScore ?? 0)} pts ________________`, rightX, cursorY, {
      align: "right",
    });
  }
  cursorY += HEADING_LINE_HEIGHT;

  if (node.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(DESC_FONT_SIZE);
    const wrapped: string[] = doc.splitTextToSize(node.description, rightX - x);
    if (draw) doc.text(wrapped, x, cursorY);
    cursorY += wrapped.length * DESC_LINE_HEIGHT;
  }

  cursorY += LEAF_GAP_AFTER;
  return cursorY;
}

export function exportScoringTemplateToPdf(
  template: ScoringTemplate,
  criteria: ScoringCriterion[],
): void {
  const roots = buildTree(criteria);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableBottom = pageHeight - MARGIN;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SÚMULA DE PONTUAÇÃO", pageWidth / 2, MARGIN, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(template.name, pageWidth / 2, MARGIN + 18, { align: "center" });

  let cursorY = MARGIN + 42;
  doc.setFontSize(9);
  doc.text(
    "Campeonato: ________________________________________________________________",
    MARGIN,
    cursorY,
  );
  cursorY += 16;
  doc.text("Equipe: _______________________________________", MARGIN, cursorY);
  doc.text("Categoria: _____________________________", pageWidth / 2 + 20, cursorY);
  cursorY += 16;
  doc.text("Juiz: _______________________________________", MARGIN, cursorY);
  doc.text("Data: _____________________________", pageWidth / 2 + 20, cursorY);
  cursorY += 28;

  // Cada critério-RAIZ (grupo com toda a subárvore, ou item de
  // avaliação solto) é uma seção atômica — nunca é cortada entre
  // páginas (só o espaço ENTRE seções pode cair numa quebra). Um grupo
  // sozinho maior que uma página inteira é o único caso em que isso
  // não é possível de garantir; não tratado aqui (não apareceu em
  // nenhum template real testado).
  roots.forEach((root, index) => {
    if (index > 0) cursorY += SECTION_GAP;
    const height = layoutNode(doc, root, 0, 0, pageWidth, false);
    if (cursorY > MARGIN && cursorY + height > usableBottom) {
      doc.addPage();
      cursorY = MARGIN;
    }
    cursorY = layoutNode(doc, root, 0, cursorY, pageWidth, true);
  });

  cursorY += SECTION_GAP;
  if (cursorY > MARGIN && cursorY + HEADING_LINE_HEIGHT > usableBottom) {
    doc.addPage();
    cursorY = MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", MARGIN, cursorY);
  doc.text(`${formatScore(template.targetScore)} pts`, pageWidth - MARGIN, cursorY, {
    align: "right",
  });
  cursorY += 30;

  const commentsHeight = 18 + 4 * 18;
  if (cursorY > MARGIN && cursorY + commentsHeight > usableBottom) {
    doc.addPage();
    cursorY = MARGIN;
  }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Comentários:", MARGIN, cursorY);
  cursorY += 18;
  doc.setDrawColor(180);
  for (let i = 0; i < 4; i++) {
    doc.line(MARGIN, cursorY, pageWidth - MARGIN, cursorY);
    cursorY += 18;
  }

  doc.save(`sumula-${slugify(template.name)}.pdf`);
}
