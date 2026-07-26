import {
  Building2,
  CalendarCheck,
  FileText,
  Percent,
  PlayCircle,
  Send,
  Tag,
  Trash2,
  Undo2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { EventActivityAction } from "@/api/client";

export const EVENT_ACTIVITY_ACTION_ICONS: Record<EventActivityAction, LucideIcon> = {
  created: CalendarCheck,
  updated: FileText,
  published: Send,
  unpublished: Undo2,
  started: PlayCircle,
  deleted: Trash2,
  category_created: Tag,
  category_updated: Tag,
  category_deleted: Tag,
  program_created: Building2,
  program_updated: Building2,
  program_deleted: Building2,
  team_created: Users,
  team_updated: Users,
  team_deleted: Users,
  regulation_document_uploaded: FileText,
  regulation_document_removed: FileText,
  regulation_deductions_updated: Percent,
  staff_member_added: UserCog,
  staff_member_updated: UserCog,
  staff_member_removed: UserCog,
};

// Ação foi de exclusão/reversão — usado só pra colorir o ícone
// (vermelho/âmbar) em vez de um mapa de cor por ação individual.
export function isDestructiveActivityAction(action: EventActivityAction): boolean {
  return (
    action.endsWith("_deleted") ||
    action === "deleted" ||
    action === "unpublished" ||
    action === "regulation_document_removed" ||
    action === "staff_member_removed"
  );
}
