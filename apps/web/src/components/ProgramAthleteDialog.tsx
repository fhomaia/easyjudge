import { useEffect, useState, type FormEvent } from "react";
import { subYears } from "date-fns";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/FormError";
import { DatePicker } from "@/components/DatePicker";
import { formatCpf } from "@/lib/masks";
import { athleteName } from "@/lib/programAthletes";
import { programAthletesApi, ApiError, type ProgramAthlete } from "@/api/client";

interface ProgramAthleteDialogProps {
  eventId: string;
  programId: string;
  open: boolean;
  // Com atleta = editar; sem = cadastrar.
  athlete?: ProgramAthlete | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (athlete: ProgramAthlete) => void;
}

const TODAY = new Date();
const OLDEST_BIRTH_MONTH = subYears(TODAY, 100);

// Atleta inscrito pelo programa neste evento: nome e email obrigatórios,
// CPF e nascimento opcionais.
export function ProgramAthleteDialog({
  eventId,
  programId,
  open,
  athlete,
  onOpenChange,
  onSaved,
}: ProgramAthleteDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // CPF/data da conta do atleta: preenchidos e travados (cadeado).
  const cpfLocked = !!athlete?.accountCpf;
  const birthLocked = !!athlete?.accountBirthDate;

  useEffect(() => {
    if (!open) return;
    setFullName(athlete ? athleteName(athlete) : "");
    setEmail(athlete?.email ?? "");
    const knownCpf = athlete?.accountCpf ?? athlete?.cpf;
    setCpf(knownCpf ? formatCpf(knownCpf) : "");
    setBirthDate(athlete?.accountBirthDate ?? athlete?.birthDate ?? "");
    setError(null);
  }, [open, athlete]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Um campo só de nome completo, separado no primeiro espaço (mesma
      // regra de CreateAthleteDialog); o `pattern` garante as duas partes.
      const name = fullName.trim().replace(/\s+/g, " ");
      const i = name.indexOf(" ");
      const payload = {
        firstName: name.slice(0, i),
        lastName: name.slice(i + 1),
        email: email.trim(),
        // Da conta do atleta: não se mexe (fica o que estava no atleta).
        cpf: cpfLocked ? athlete?.cpf ?? null : cpf.replace(/\D/g, "") || null,
        birthDate: birthLocked ? athlete?.birthDate ?? null : birthDate || null,
      };
      const saved = athlete
        ? await programAthletesApi.update(eventId, programId, athlete.id, payload)
        : await programAthletesApi.create(eventId, programId, payload);
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const cpfDigits = cpf.replace(/\D/g, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-7 overflow-y-auto p-6 sm:max-w-lg sm:p-10">
        <div className="grid gap-1.5">
          <DialogTitle className="text-xl font-medium">
            {athlete ? "Editar atleta" : "Adicionar atleta"}
          </DialogTitle>
          <DialogDescription>
            Atleta inscrito por este programa neste evento.
          </DialogDescription>
        </div>

        <FormError message={error} />

        <form onSubmit={handleSubmit} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <div className="grid gap-2">
            <Label htmlFor="program-athlete-name">Nome completo</Label>
            <Input
              id="program-athlete-name"
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              pattern="\s*\S+\s+\S.*"
              title="Informe o nome completo (nome e sobrenome)."
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="program-athlete-email">Email</Label>
            <Input
              id="program-athlete-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
              <Label htmlFor="program-athlete-cpf" className="flex items-center gap-1.5">
                CPF (opcional)
                {cpfLocked && <AccountLock />}
              </Label>
              <Input
                id="program-athlete-cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                disabled={cpfLocked}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                aria-invalid={!cpfLocked && cpfDigits.length > 0 && cpfDigits.length < 11}
              />
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
              <Label htmlFor="program-athlete-birth" className="flex items-center gap-1.5">
                Nascimento (opcional)
                {birthLocked && <AccountLock />}
              </Label>
              <DatePicker
                id="program-athlete-birth"
                disabled={birthLocked}
                value={birthDate}
                onChange={setBirthDate}
                captionLayout="dropdown"
                startMonth={OLDEST_BIRTH_MONTH}
                endMonth={TODAY}
                maxDate={TODAY}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || (!cpfLocked && cpfDigits.length > 0 && cpfDigits.length < 11)}
            className="w-full"
          >
            {loading ? "Salvando..." : athlete ? "Salvar" : "Adicionar atleta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Cadeado do dado que vem da conta do atleta (motivo na dica).
function AccountLock() {
  return (
    <span
      title="Vem da conta do atleta: não dá para alterar aqui."
      aria-label="Vem da conta do atleta"
      className="text-muted-foreground"
    >
      <Lock className="size-3.5" />
    </span>
  );
}
