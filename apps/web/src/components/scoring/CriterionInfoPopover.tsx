import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface CriterionInfoPopoverProps {
  description: string;
  label: string;
  colorClassName?: string;
}

// Ícone de informação clicável (não só `aria-label` estático) — usado
// pra descrição de grupo, de critério e de faixa de pontuação na tela
// do jurado. Ver ScoringCriteriaGroups.tsx / ScoreBandSlider.tsx.
export function CriterionInfoPopover({ description, label, colorClassName }: CriterionInfoPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={label}
            className={colorClassName ?? "text-muted-foreground"}
          />
        }
      >
        <Info className="size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm text-foreground">{description}</PopoverContent>
    </Popover>
  );
}
