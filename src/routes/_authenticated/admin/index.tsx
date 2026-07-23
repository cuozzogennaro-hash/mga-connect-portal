import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const ok = useRequireRole("admin");
  if (!ok) return null;
  return (
    <AppShell
      title="Pannello Amministrazione"
      role="Admin"
      nav={[
        { to: "/admin", label: "Dashboard" },
        { to: "/admin/utenti", label: "Utenti" },
        { to: "/admin/promozioni", label: "Promozioni" },
        { to: "/admin/contabilita", label: "Contabilità" },
      ]}
    >
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { t: "Utenti", d: "Gestisci clienti B2B e operatori." },
          { t: "Promozioni", d: "Pubblica offerte settimanali." },
          { t: "Contabilità", d: "OCR scontrini e generazione DDT." },
        ].map((c) => (
          <div key={c.t} className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-serif text-xl font-semibold text-primary">{c.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
