import { VIBRANT_COLORS } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";

interface ResourceColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ResourceColorPicker({ value, onChange }: ResourceColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {VIBRANT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          style={{ backgroundColor: color }}
          className={cn(
            "size-7 shrink-0 rounded-full transition-transform hover:scale-110",
            value === color && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          )}
          aria-label={`Cor ${color}`}
        />
      ))}
    </div>
  );
}
