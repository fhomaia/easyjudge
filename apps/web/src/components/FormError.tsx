import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  // Mensagem com várias linhas (ex.: um problema por atleta) vira tópicos.
  const lines = message.split("\n").filter((line) => line.trim());

  return (
    <Alert variant="destructive">
      <AlertDescription>
        {lines.length > 1 ? (
          <ul className="list-disc space-y-1 pl-4">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          message
        )}
      </AlertDescription>
    </Alert>
  );
}
