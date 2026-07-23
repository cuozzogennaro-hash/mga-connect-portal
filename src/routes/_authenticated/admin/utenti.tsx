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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

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

function UtentiAdmin() {
  const { role } = useRequireRole("admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [ruolo, setRuolo] = useState<"operatore_preparazione" | "admin">("operatore_preparazione");
  const [saving, setSaving] = useState(false);
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
        role: map.get(p.id) ?? "—",
      })),
    );
  }
  useEffect(() => {
    refresh();
  }, []);

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
    <AppShell title="Gestione utenti" role="Admin" nav={adminNav}>
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
          <h2 className="font-serif text-xl font-semibold">Elenco utenti</h2>
          <div className="mt-4 space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{r.ragione_sociale ?? r.email ?? r.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.email} {r.partita_iva && `· P.IVA ${r.partita_iva}`}
                  </p>
                </div>
                <Badge variant={r.role === "admin" ? "default" : "secondary"}>{r.role}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
