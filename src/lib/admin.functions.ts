import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ADMIN_EMAIL = "admin@mgaalimentari.it";
const ADMIN_PASSWORD = "AdminPassword123!";

// Idempotent: creates the default admin user if missing. Public server fn (no auth) but safe: only creates the seed admin.
export const ensureDefaultAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Check if any admin already exists
  const { data: existingRoles } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "admin")
    .limit(1);

  if (existingRoles && existingRoles.length > 0) {
    return { ok: true, created: false };
  }

  // Try to create the default admin user
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { nome: "Amministratore MGA", role: "admin" },
  });

  if (createErr) {
    // If user already exists (created previously) → fetch it and ensure the role
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const existing = list?.users.find((u) => u.email === ADMIN_EMAIL);
    if (!existing) return { ok: false, error: createErr.message };
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });
    return { ok: true, created: false, note: "role_ensured" };
  }

  if (created?.user) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
  }

  return { ok: true, created: true };
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nome: z.string().min(1),
  role: z.enum(["operatore_preparazione", "admin"]),
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => createUserSchema.parse(raw))
  .handler(async ({ data, context }) => {
    // Verify caller is admin using their RLS-scoped client
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome, role: data.role },
    });
    if (error) throw new Error(error.message);
    return { ok: true, userId: created.user?.id };
  });

const ocrSchema = z.object({ ordineId: z.string().uuid() });

export const adminOcrScontrino = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ocrSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ordine, error: oErr } = await supabaseAdmin
      .from("ordini")
      .select("id, scontrino_url")
      .eq("id", data.ordineId)
      .single();
    if (oErr || !ordine?.scontrino_url) throw new Error("Scontrino non trovato");

    // Create signed URL for the private bucket image
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("scontrini")
      .createSignedUrl(ordine.scontrino_url, 60 * 5);
    if (sErr || !signed) throw new Error("Impossibile leggere lo scontrino");

    // Call Lovable AI Gateway (Gemini vision) — expects image URL
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY mancante");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Sei un assistente di contabilità. Analizza lo scontrino di cassa italiano e restituisci SOLO JSON valido con schema: { totale: number, iva: number, imponibile: number, voci: [{ descrizione: string, quantita: number, prezzo: number, iva_perc: number }] }. Se un campo è illeggibile, usa null.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Estrai i dati dello scontrino." },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI Gateway: ${res.status} ${txt.slice(0, 200)}`);
    }
    const ai = await res.json();
    const content = ai.choices?.[0]?.message?.content ?? "{}";
    let parsed: {
      totale?: number;
      iva?: number;
      imponibile?: number;
      voci?: Array<{ descrizione: string; quantita?: number; prezzo?: number; iva_perc?: number }>;
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Risposta AI non valida");
    }

    await supabaseAdmin
      .from("ordini")
      .update({
        ocr_data: parsed,
        ocr_totale: parsed.totale ?? null,
        ocr_iva: parsed.iva ?? null,
      })
      .eq("id", data.ordineId);

    return { ok: true, data: parsed };
  });

const ddtSchema = z.object({ ordineId: z.string().uuid() });

export const adminGeneraDDT = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ddtSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ordine, error } = await supabaseAdmin
      .from("ordini")
      .select("id, cliente_id, ocr_data, ocr_totale, ocr_iva, created_at, profiles:cliente_id(ragione_sociale, partita_iva, indirizzo_consegna, referente)")
      .eq("id", data.ordineId)
      .single();
    if (error || !ordine) throw new Error("Ordine non trovato");

    const anno = new Date().getFullYear();
    const { data: numeroRes, error: nErr } = await supabaseAdmin.rpc("next_bolla_numero", { _anno: anno });
    if (nErr) throw new Error(nErr.message);
    const numero = numeroRes as number;

    const ocr = (ordine.ocr_data as {
      totale?: number;
      iva?: number;
      imponibile?: number;
      voci?: Array<{ descrizione: string; quantita?: number; prezzo?: number; iva_perc?: number }>;
    }) ?? {};
    const totale = ocr.totale ?? ordine.ocr_totale ?? 0;
    const iva = ocr.iva ?? ordine.ocr_iva ?? 0;
    const imponibile = ocr.imponibile ?? Math.max(0, Number(totale) - Number(iva));

    // Insert bolla + righe
    const { data: bolla, error: bErr } = await supabaseAdmin
      .from("bolle")
      .insert({
        numero,
        anno,
        cliente_id: ordine.cliente_id,
        ordine_id: ordine.id,
        totale,
        iva,
        imponibile,
      })
      .select("id")
      .single();
    if (bErr || !bolla) throw new Error(bErr?.message ?? "Errore creazione bolla");

    if (ocr.voci && ocr.voci.length > 0) {
      await supabaseAdmin.from("bolle_righe").insert(
        ocr.voci.map((v, i) => ({
          bolla_id: bolla.id,
          posizione: i,
          descrizione: v.descrizione ?? "Voce",
          quantita: v.quantita ?? 1,
          prezzo: v.prezzo ?? null,
          iva_perc: v.iva_perc ?? 22,
          totale_riga: (v.quantita ?? 1) * (v.prezzo ?? 0),
        })),
      );
    }

    // Generate PDF via pdf-lib
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const cliente = ordine.profiles as {
      ragione_sociale?: string;
      partita_iva?: string;
      indirizzo_consegna?: string;
      referente?: string;
    } | null;

    let y = 800;
    const draw = (t: string, opts: { size?: number; b?: boolean; x?: number } = {}) => {
      page.drawText(t, {
        x: opts.x ?? 50,
        y,
        size: opts.size ?? 10,
        font: opts.b ? bold : font,
        color: rgb(0.1, 0.05, 0.05),
      });
    };
    draw("M.G.A. ALIMENTARI CUOZZO S.r.l.", { size: 16, b: true });
    y -= 18;
    draw("Via dell'Alimentare, 12 — 84010 Costiera Amalfitana (SA)");
    y -= 14;
    draw("P.IVA IT01234567890 — Tel +39 089 000 0000");
    y -= 30;
    draw(`DOCUMENTO DI TRASPORTO N. ${numero}/${anno}`, { size: 14, b: true });
    y -= 20;
    draw(`Data: ${new Date().toLocaleDateString("it-IT")}`);
    y -= 25;
    draw("DESTINATARIO", { b: true });
    y -= 14;
    draw(cliente?.ragione_sociale ?? "");
    y -= 12;
    draw(`P.IVA: ${cliente?.partita_iva ?? "-"}`);
    y -= 12;
    draw(`Indirizzo: ${cliente?.indirizzo_consegna ?? "-"}`);
    y -= 12;
    draw(`Referente: ${cliente?.referente ?? "-"}`);
    y -= 25;
    draw("Descrizione", { b: true, x: 50 });
    draw("Q.tà", { b: true, x: 320 });
    draw("Prezzo", { b: true, x: 380 });
    draw("IVA%", { b: true, x: 450 });
    draw("Totale", { b: true, x: 500 });
    y -= 6;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.4, 0.2, 0.15) });
    y -= 14;
    for (const v of ocr.voci ?? []) {
      draw(String(v.descrizione ?? "").slice(0, 45), { x: 50 });
      draw(String(v.quantita ?? ""), { x: 320 });
      draw(v.prezzo != null ? `€ ${Number(v.prezzo).toFixed(2)}` : "", { x: 380 });
      draw(v.iva_perc != null ? `${v.iva_perc}%` : "", { x: 450 });
      draw(
        v.quantita != null && v.prezzo != null ? `€ ${(Number(v.quantita) * Number(v.prezzo)).toFixed(2)}` : "",
        { x: 500 },
      );
      y -= 14;
      if (y < 120) {
        y = 800;
      }
    }
    y -= 20;
    page.drawLine({ start: { x: 320, y }, end: { x: 545, y }, thickness: 0.5 });
    y -= 14;
    draw(`Imponibile: € ${Number(imponibile).toFixed(2)}`, { x: 380, b: true });
    y -= 14;
    draw(`IVA: € ${Number(iva).toFixed(2)}`, { x: 380, b: true });
    y -= 14;
    draw(`TOTALE: € ${Number(totale).toFixed(2)}`, { x: 380, b: true, size: 12 });

    const pdfBytes = await pdf.save();
    const path = `${ordine.cliente_id}/${anno}-${String(numero).padStart(5, "0")}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("bolle")
      .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("bolle").update({ pdf_url: path }).eq("id", bolla.id);
    await supabaseAdmin.from("ordini").update({ stato: "evaso" }).eq("id", ordine.id);

    return { ok: true, bollaId: bolla.id, numero, anno };
  });

const signSchema = z.object({ path: z.string(), bucket: z.enum(["bolle", "scontrini", "promozioni"]) });

export const getSignedFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => signSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Access check: RLS-scoped select against the object owner via the bolle/ordini row
    if (data.bucket === "bolle") {
      const { data: b } = await context.supabase
        .from("bolle")
        .select("cliente_id")
        .eq("pdf_url", data.path)
        .maybeSingle();
      if (!b) throw new Error("Non autorizzato");
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 60 * 10);
    if (error || !signed) throw new Error("Impossibile generare link");
    return { url: signed.signedUrl };
  });

const pagamentoSchema = z.object({
  bollaId: z.string().uuid(),
  stato: z.enum(["in_attesa", "pagato"]),
});

export const adminSetPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => pagamentoSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("bolle")
      .update({
        stato_pagamento: data.stato,
        pagato_il: data.stato === "pagato" ? new Date().toISOString() : null,
      })
      .eq("id", data.bollaId);
    return { ok: true };
  });
