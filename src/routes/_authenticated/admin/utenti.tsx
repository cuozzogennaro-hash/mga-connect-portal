import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useRequireRole } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";

const adminNav = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/utenti", label: "Utenti" },
  { to: "/admin/promozioni", label: "Promozioni" },
  { to: "/admin/ordini", label: "Ordini & OCR" },
  { to: "/admin/contabilita", label: "Contabilità" },
];

export const Route = createFileRoute("/_authenticated/admin/utenti")({
  head: () => ({
    meta: [{ title: "Utenti — MGA Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: UtentiAdmin,
});

type Row = {
  id: string;
  email: string | null;
  ragione_sociale: string | null;
  partita_iva: string | null;
  role: string;
};

type ListinoItem = {
  id: string;
  cliente_id: string;
  descrizione_prodotto: string;
  prezzo: number;
  unita_misura: string;
  note?: string | null;
};

function UtentiAdmin() {
  const { role } = useRequireRole("admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [ruolo, setRuolo] = useState<"operatore_preparazione" | "admin">("operatore_preparazione");
  const [saving, setSaving] = useState(false);

  // Stato per la gestione del listino personalizzato cliente
  const [selectedCliente, setSelectedCliente] = useState<Row | null>(null);
  const [listinoItems, setListinoItems] = useState<ListinoItem[]>([]);
  const [loadingListino, setLoadingListino] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newPrezzo, setNewPrezzo] = useState("");
  const [newUnita, setNewUnita] = useState("kg");
  const [newNote, setNewNote] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const createUser = useServerFn(adminCreateUser);

  async function refresh() {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, ragione_sociale, partita_iva");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const map = new Map<string, string>();
    for (const r of roles ?? []) map.set(r.user_id, r.role as string);
    setRows(
      (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        ragione_sociale: p.ragione_sociale,
        partita_iva: p.partita_iva,
        role: map.get(p.id) ?? "cliente",
      })),
    );
  }

  useEffect(() => {
    refresh();
  }, []);

  async function loadListino(cliente: Row) {
    setSelectedCliente(cliente);
    setLoadingListino(true);
    const { data } = await supabase
      .from("listini_clienti")
      .select("*")
      .eq("cliente_id", cliente.id)
      .order("descrizione_prodotto", { ascending: true });

    setListinoItems((data ?? []) as ListinoItem[]);
    setLoadingListino(false);
  }

  async function addListinoItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCliente || !newDesc || !newPrezzo) return;

    setAddingItem(true);
    const { error } = await supabase.from("listini_clienti").insert({
      cliente_id: selectedCliente.id,
      descrizione_prodotto: newDesc.trim(),
      prezzo: parseFloat(newPrezzo),
      unita_misura: newUnita,
      note: newNote.trim() || null,
    });

    setAddingItem(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Prodotto aggiunto al listino");
    setNewDesc("");
    setNewPrezzo("");
    setNewNote("");
    loadListino(selectedCliente);
  }

  async function deleteListinoItem(itemId: string) {
    if (!selectedCliente) return;
    const { error } = await supabase.from("listini_clienti").delete().eq("id", itemId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Prodotto rimosso dal listino");
    loadListino(selectedCliente);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser({ data: { email, password, nome, role: ruolo } });
      toast.success("Utente creato");
      setEmail("");
      setPassword("");
      setNome("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  }

  if (!role) return null;
  return (
    <AppShell title="Gestione utenti e listini" role="Admin" nav={adminNav}>
      <div className="grid gap-8 lg:grid-cols-5">
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="font-serif text-xl font-semibold">Nuovo operatore / admin</h2>
          <div className="mt-4 space-y-3">
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="text" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Ruolo</Label>
              <Select value={ruolo} onValueChange={(v) => setRuolo(v as typeof ruolo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operatore_preparazione">Operatore preparazione</SelectItem>
                  <SelectItem value="admin">Amministratore</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Creazione…" : "Crea utente"}
            </Button>
          </div>
        </form>

        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-3">
          <h2 className="font-serif text-xl font-semibold">Elenco utenti & listini B2B</h2>
          <div className="mt-4 space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border p-3.5 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-base">{r.ragione_sociale ?? r.email ?? r.id}</p>
                    <Badge variant={r.role === "admin" ? "default" : r.role === "operatore_preparazione" ? "secondary" : "outline"}>
                      {r.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.email} {r.partita_iva && `· P.IVA ${r.partita_iva}`}
                  </p>
                </div>

                {r.role === "cliente" || r.role === "—" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadListino(r)}
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Listino Personalizzato
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DIALOG GESTIONE LISTINO PERSONALIZZATO CLIENTE */}
      <Dialog open={!!selectedCliente} onOpenChange={(open) => !open && setSelectedCliente(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Listino Personalizzato: {selectedCliente?.ragione_sociale ?? selectedCliente?.email}
            </DialogTitle>
            <DialogDescription>
              Aggiungi o modifica i prezzi pattuiti per questo cliente. L'operatore in laboratorio consulterà questo listino per fare il conto degli ordini.
            </DialogDescription>
          </DialogHeader>

          {/* FORM AGGIUNTA PRODOTTO AL LISTINO */}
          <form onSubmit={addListinoItem} className="bg-muted/40 p-4 rounded-xl space-y-3 border border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aggiungi Voci a Listino</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Descrizione Prodotto</Label>
                <Input
                  required
                  placeholder="Es. Mozzarella di Bufala DOP 250g"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Prezzo €</Label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="12.50"
                  value={newPrezzo}
                  onChange={(e) => setNewPrezzo(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs">Unità Misura</Label>
                <Select value={newUnita} onValueChange={setNewUnita}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">€ / kg</SelectItem>
                    <SelectItem value="cassa">€ / cassa</SelectItem>
                    <SelectItem value="pz">€ / pezzo</SelectItem>
                    <SelectItem value="conf">€ / confezione</SelectItem>
                    <SelectItem value="l">€ / litro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs">Note Prodotto / Offerta (Opzionale)</Label>
                <Input
                  placeholder="Es. Prezzo speciale fino a fine mese"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" disabled={addingItem} size="sm" className="w-full mt-2">
              <Plus className="h-4 w-4 mr-1" /> {addingItem ? "Salvataggio…" : "Aggiungi al Listino"}
            </Button>
          </form>

          {/* TABELLA LISTINO ATTUALE */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Prodotti e Prezzi in Listino ({listinoItems.length})
            </h4>

            {loadingListino ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Caricamento listino…</p>
            ) : listinoItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nessun prodotto in listino per questo cliente. Compila il form in alto per aggiungerne.
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Prodotto</th>
                      <th className="px-3 py-2 text-right">Prezzo Unitario</th>
                      <th className="px-3 py-2">Note</th>
                      <th className="px-3 py-2 text-right">Azione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {listinoItems.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{item.descrizione_prodotto}</td>
                        <td className="px-3 py-2 font-bold text-right text-emerald-700 dark:text-emerald-400">
                          € {Number(item.prezzo).toFixed(2)} / {item.unita_misura}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground italic">{item.note ?? "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteListinoItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

