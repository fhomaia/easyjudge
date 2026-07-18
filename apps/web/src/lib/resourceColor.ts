import { getAvatarColor } from "./avatarColor";

// Recursos criados antes da coluna `color` existir (ou sem cor
// escolhida) caem numa cor determinística (hash do id) — nunca ficam
// sem cor na legenda/timeline.
export function getResourceColor(resource: { id: string; color: string | null }): string {
  return resource.color ?? getAvatarColor(resource.id);
}
