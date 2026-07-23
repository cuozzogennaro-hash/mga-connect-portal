import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Pannello Admin — MGA Connect" },
      { name: "description", content: "Amministrazione MGA Connect: utenti, promozioni, OCR scontrini e contabilità." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminHome,
});

const adminNav = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/utenti", label: "Utenti" },
  { to: "/admin/promozioni", label: "Promozioni" },
  { to: "/admin/ordini", label: "Ordini & OCR" },
  { to: "/admin/contabilita", label: "Contabilità" },
];

function AdminHome() {
  const { role } = useRequireRole("admin");
  if (!role) return null;
  const cards = [
    { to: "/admin/utenti", t: "Utenti", d: "Crea operatori e amministratori, consulta i clienti B2B registrati." },
    { to: "/admin/promozioni", t: "Promozioni", d: "Pubblica le offerte settimanali visibili ai clienti." },
    { to: "/admin/ordini", t: "Ordini & OCR", d: "Analizza gli scontrini con AI e genera le bolle DDT." },
    { to: "/admin/contabilita", t: "Contabilità", d: "Storico bolle per cliente e stato dei pagamenti." },
  ];
  return (
    <AppShell title="Pannello Amministrazione" role="Admin" nav={adminNav}>
      <div className="grid gap-6 md:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary"
          >
            <h3 className="font-serif text-xl font-semibold text-primary">{c.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
