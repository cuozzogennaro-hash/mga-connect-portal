import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operatore/")({
  head: () => ({
    meta: [
      { title: "Preparazione ordini — MGA Connect" },
      { name: "description", content: "Dashboard operatore: gestisci ordini in preparazione in tempo reale." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OperatoreHome,
});

type Ordine = {
  id: string;
  stato: string;
  created_at: string;
  data_ritiro: string | null;
  note: string | null;
  scontrino_url: string | null;
  cliente_id: string;
  ordini_righe: { descrizione: string; quantita: string | null }[];
  profiles: { ragione_sociale: string | null; referente: string | null; telefono: string | null } | null;
};

function OperatoreHome() {
  const { role } = useRequireRole("operatore_preparazione");
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select(
        "id, stato, created_at, data_ritiro, note, scontrino_url, cliente_id, ordini_righe(descrizione, quantita, posizione), profiles:cliente_id(ragione_sociale, referente, telefono)",
      )
      .in("stato", ["nuovo", "scontrinato", "evaso"])
      .order("created_at", { ascending: true });
    setOrdini((data ?? []) as unknown as Ordine[]);
  }

  useEffect(() => {
    refresh();

    // Aggiorna ogni secondo per sbloccare automaticamente gli ordini trascorsi i 2 minuti
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const ch = supabase
      .channel("ordini-operatore")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordini" }, () => refresh())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, []);

  async function uploadScontrino(ordineId: string, file: File) {
    setUploading(ordineId);
    const path = `${ordineId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("scontrini").upload(path, file, { upsert: false });
    if (error) {
      setUploading(null);
      toast.error(error.message);
      return;
    }
    const { error: uErr } = await supabase
      .from("ordini")
      .update({ scontrino_url: path, stato: "scontrinato" })
      .eq("id", ordineId);
    setUploading(null);
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success("Foto scontrino caricata! Ordine marcato come COMPLETO.");
    refresh();
  }

  // Gli ordini compaiono all'operatore SOLO dopo che sono trascorsi 2 minuti (120000 ms) dalla creazione
  const ordiniReady = ordini.filter((o) => {
    if (o.stato === "scontrinato" || o.stato === "completo") return true;
    const createdAt = new Date(o.created_at).getTime();
    return now - createdAt >= 120000;
  });

  if (!role) return null;
  return (
    <AppShell title="Ordini in preparazione" role="Operatore">
      <p className="mb-6 text-muted-foreground">
        Gli ordini appaiono qui in tempo reale <strong>2 minuti dopo l'invio del cliente</strong> (terminata la finestra di ripensamento). Prepara l'ordine e carica la foto dello scontrino di cassa per completarlo.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {ordiniReady.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground md:col-span-2">
            Nessun ordine pronto per la preparazione in magazzino.
          </div>
        )}
        {ordiniReady.map((o) => (
          <OrdineCard key={o.id} ordine={o} onUpload={uploadScontrino} uploading={uploading === o.id} />
        ))}
      </div>
    </AppShell>
  );
}

function OrdineCard({
  ordine,
  onUpload,
  uploading,
}: {
  ordine: Ordine;
  onUpload: (id: string, f: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompleto = ordine.stato === "scontrinato" || ordine.stato === "completo";

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-xl font-semibold">
            {ordine.profiles?.ragione_sociale ?? "Cliente"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {ordine.profiles?.referente ?? ""} · {ordine.profiles?.telefono ?? ""}
          </p>
        </div>
        <Badge variant={isCompleto ? "outline" : "default"} className={isCompleto ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400" : "bg-blue-600 text-white"}>
          {isCompleto ? "Completo" : "Presa in carico"}
        </Badge>
      </header>
      <p className="mt-2 text-xs text-muted-foreground">
        Ricevuto {new Date(ordine.created_at).toLocaleString("it-IT")}
        {ordine.data_ritiro && ` · Ritiro ${new Date(ordine.data_ritiro).toLocaleDateString("it-IT")}`}
      </p>
      <ul className="mt-3 space-y-1 text-base">
        {ordine.ordini_righe.map((r, i) => (
          <li key={i} className="flex justify-between border-b border-dashed border-border/50 py-1">
            <span className="font-medium">{r.descrizione}</span>
            <span className="text-muted-foreground font-semibold">{r.quantita ?? ""}</span>
          </li>
        ))}
      </ul>
      {ordine.note && <p className="mt-2 text-sm italic text-muted-foreground">Nota: {ordine.note}</p>}
      <div className="mt-4 flex gap-2">
        <Button
          size="lg"
          className="flex-1"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Caricamento…" : ordine.scontrino_url ? "Ricarica scontrino" : "📸 Carica Foto Scontrino"}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => window.print()}
        >
          Stampa
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(ordine.id, f);
          e.target.value = "";
        }}
      />
    </article>
  );
}

