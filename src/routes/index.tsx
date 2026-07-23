import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MGA } from "@/lib/mga";
import heroImg from "@/assets/hero-mga.jpg";
import { ensureDefaultAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${MGA.brand} — Ingrosso Alimentari per la Ristorazione` },
      {
        name: "description",
        content:
          "M.G.A. Alimentari Cuozzo S.r.l. — Ingrosso alimentari per ristoranti, pizzerie e attività ho.re.ca. Ordina H24 con MGA Connect.",
      },
      { property: "og:title", content: `${MGA.brand} — ${MGA.ragioneSociale}` },
      { property: "og:description", content: "Portale ordini B2B, promozioni riservate e consegne rapide." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  useEffect(() => {
    // Idempotent seed of default admin on first landing visit
    ensureDefaultAdmin().catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-2xl font-semibold text-primary">MGA</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Alimentari Cuozzo
            </span>
          </div>
          <nav className="hidden gap-8 text-sm font-medium md:flex">
            <a href="#chi-siamo" className="hover:text-primary">Chi Siamo</a>
            <a href="#servizi" className="hover:text-primary">Servizi B2B</a>
            <a href="#contatti" className="hover:text-primary">Contatti</a>
          </nav>
          <Link to="/auth">
            <Button variant="outline" size="sm">Accedi</Button>
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Dal 1978 · Ingrosso Alimentari
            </p>
            <h1 className="font-serif text-5xl font-semibold leading-[1.05] text-foreground md:text-6xl">
              La tradizione della qualità,
              <br />
              <span className="text-primary italic">al servizio dei professionisti.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              M.G.A. Alimentari Cuozzo S.r.l. fornisce ristoranti, pizzerie e attività Ho.re.ca. con
              prodotti selezionati, consegne rapide e prezzi riservati. Ora anche con{" "}
              <strong className="text-foreground">MGA Connect</strong>, il portale ordini H24.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto">
                  Accedi a MGA Connect
                </Button>
              </Link>
              <Link to="/registrazione">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Diventa Cliente B2B
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-2xl" aria-hidden />
            <img
              src={heroImg}
              alt="Ingrosso alimentari M.G.A. Cuozzo"
              width={1600}
              height={1008}
              className="relative rounded-2xl border border-border shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* CHI SIAMO */}
      <section id="chi-siamo" className="border-y border-border/60 bg-muted/30 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
            Chi Siamo
          </p>
          <h2 className="font-serif text-4xl font-semibold md:text-5xl">
            Quarant'anni di eccellenza al servizio della ristorazione
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            M.G.A. Alimentari Cuozzo S.r.l. è punto di riferimento nell'ingrosso alimentare per
            professionisti. Selezioniamo salumi, formaggi, olio, conserve, prodotti freschi e da
            forno da produttori italiani di fiducia, garantendo qualità costante, prezzi competitivi
            e velocità di servizio. La nostra missione è farvi trovare la merce giusta, quando e
            dove vi serve.
          </p>
        </div>
      </section>

      {/* SERVIZI */}
      <section id="servizi" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              Servizi B2B
            </p>
            <h2 className="font-serif text-4xl font-semibold md:text-5xl">
              Il portale MGA Connect
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Un unico strumento per gestire ordini, promozioni e documenti amministrativi.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Ordini H24", d: "Inserisci ordini in qualsiasi momento, dal telefono o dal computer." },
              { t: "Promozioni Riservate", d: "Sconti dedicati e occasioni settimanali visibili solo ai clienti B2B." },
              { t: "Consegne Rapide", d: "L'ordine arriva in sala preparazione all'istante, per evadere prima." },
              { t: "DDT e Fatturazione", d: "Bolle di accompagnamento chiare, storico completo, stato pagamenti." },
            ].map((s) => (
              <div
                key={s.t}
                className="rounded-xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="font-serif text-xl">✦</span>
                </div>
                <h3 className="font-serif text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="border-y border-border/60 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-16 text-center">
          <h2 className="font-serif text-4xl md:text-5xl">Pronti a semplificare i vostri ordini?</h2>
          <p className="max-w-xl text-primary-foreground/80">
            Registrati con la tua Partita IVA e accedi subito alle condizioni riservate ai
            professionisti.
          </p>
          <Link to="/registrazione">
            <Button size="lg" variant="secondary">Diventa Cliente B2B</Button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contatti" className="bg-background py-14">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          <div>
            <div className="font-serif text-2xl font-semibold text-primary">MGA</div>
            <p className="mt-2 text-sm text-muted-foreground">{MGA.ragioneSociale}</p>
            <p className="mt-1 text-sm text-muted-foreground">P.IVA {MGA.piva}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-primary">
              Contatti
            </h4>
            <p className="mt-3 text-sm text-muted-foreground">{MGA.indirizzo}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tel {MGA.telefono}</p>
            <p className="mt-1 text-sm text-muted-foreground">{MGA.email}</p>
            <p className="mt-3 text-sm text-muted-foreground">{MGA.orari}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-primary">
              Link Rapidi
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/auth" className="hover:text-primary">Accedi a MGA Connect</Link></li>
              <li><Link to="/registrazione" className="hover:text-primary">Registrazione B2B</Link></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-6xl border-t border-border px-6 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {MGA.ragioneSociale} — Tutti i diritti riservati
        </div>
      </footer>
    </div>
  );
}
