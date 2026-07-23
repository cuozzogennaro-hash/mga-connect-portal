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

  async function refresh() {
    const { data } = await supabase
      .from("ordini")
      .select(
        "id, stato, created_at, data_ritiro, note, scontrino_url, cliente_id, ordini_righe(descrizione, quantita, posizione), profiles:cliente_id(ragione_sociale, referente, telefono)",
      )
      .in("stato", ["nuovo", "scontrinato"])
      .order("created_at", { ascending: true });
    setOrdini((data ?? []) as unknown as Ordine[]);
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("ordini-operatore")
      .on("postgres_changes", { event: "*", schema: "public", table: "ordini" }, () => refresh())
      .subscribe();
    return () => {
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
    toast.success("Scontrino caricato");
    refresh();
  }

  if (!role) return null;
  return (
    <AppShell title="Ordini in preparazione" role="Operatore">
      <p className="mb-6 text-muted-foreground">
        Gli ordini appaiono qui in tempo reale. Prepara l'ordine, batti lo scontrino di cassa, poi caricalo tramite il pulsante "Foto scontrino".
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {ordini.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground md:col-span-2">
            Nessun ordine da preparare.
          </div>
        )}
        {ordini.map((o) => (
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
        <Badge variant={ordine.stato === "nuovo" ? "default" : "secondary"}>
          {ordine.stato === "nuovo" ? "Nuovo" : "Scontrinato"}
        </Badge>
      </header>
      <p className="mt-2 text-xs text-muted-foreground">
        Ricevuto {new Date(ordine.created_at).toLocaleString("it-IT")}
        {ordine.data_ritiro && ` · Ritiro ${new Date(ordine.data_ritiro).toLocaleDateString("it-IT")}`}
      </p>
      <ul className="mt-3 space-y-1 text-base">
        {ordine.ordini_righe.map((r, i) => (
          <li key={i} className="flex justify-between border-b border-dashed border-border/50 py-1">
            <span>{r.descrizione}</span>
            <span className="font-medium">{r.quantita ?? ""}</span>
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
          {uploading ? "Caricamento…" : ordine.scontrino_url ? "Ricarica scontrino" : "📸 Foto scontrino"}
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
