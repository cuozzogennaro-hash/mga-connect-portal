import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/operatore/")({
  component: OperatoreHome,
});

function OperatoreHome() {
  const ok = useRequireRole("operatore_preparazione");
  if (!ok) return null;
  return (
    <AppShell title="Area Preparazione" role="Operatore">
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="font-serif text-2xl font-semibold">Ordini in preparazione</h2>
        <p className="mt-2 text-muted-foreground">
          Gli ordini arrivano qui in tempo reale, pronti per essere evasi e stampati.
        </p>
      </div>
    </AppShell>
  );
}
