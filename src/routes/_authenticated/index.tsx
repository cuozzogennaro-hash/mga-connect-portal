import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRole, rolePath } from "@/lib/roles";
import { MGA } from "@/lib/mga";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/")({
  component: RootAuthRedirect,
});

function RootAuthRedirect() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Reindirizzamento…");

  useEffect(() => {
    (async () => {
      const role = await getMyRole();
      if (!role) {
        setMsg("Nessun ruolo assegnato. Contatta l'amministratore.");
        return;
      }
      navigate({ to: rolePath[role] });
    })();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="font-serif text-3xl font-semibold text-primary">{MGA.brand}</div>
        <p className="mt-4 text-muted-foreground">{msg}</p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          Esci
        </Button>
      </div>
    </div>
  );
}
