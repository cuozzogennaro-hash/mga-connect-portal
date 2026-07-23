import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/cliente/")({
  component: ClienteHome,
});

function ClienteHome() {
  const ok = useRequireRole("cliente_b2b");
  if (!ok) return null;
  return (
    <AppShell
      title="Area Cliente B2B"
      role="Cliente"
      nav={[
        { to: "/cliente", label: "Promozioni" },
        { to: "/cliente/ordini", label: "I miei ordini" },
        { to: "/cliente/documenti", label: "Documenti" },
      ]}
    >
      <div className="rounded-xl border border-border bg-card p-8">
        <h2 className="font-serif text-2xl font-semibold">Benvenuto in MGA Connect</h2>
        <p className="mt-2 text-muted-foreground">
          Sfoglia le promozioni settimanali o inserisci un nuovo ordine libero.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Le funzioni ordini, promozioni e documenti saranno attivate a breve.
        </p>
      </div>
    </AppShell>
  );
}
