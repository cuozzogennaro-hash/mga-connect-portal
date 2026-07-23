import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "cliente_b2b" | "operatore_preparazione" | "admin";

export const rolePath: Record<AppRole, string> = {
  cliente_b2b: "/cliente",
  operatore_preparazione: "/operatore",
  admin: "/admin",
};

export async function getMyRole(): Promise<AppRole | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .order("role", { ascending: true });
  if (!data || data.length === 0) return null;
  // Priority: admin > operatore > cliente
  const roles = data.map((r) => r.role as AppRole);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("operatore_preparazione")) return "operatore_preparazione";
  return "cliente_b2b";
}

export function useMyRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    getMyRole().then((r) => {
      if (mounted) {
        setRole(r);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  return { role, loading };
}

export function useRequireRole(expected: AppRole | AppRole[]) {
  const navigate = useNavigate();
  const { role, loading } = useMyRole();
  const list = Array.isArray(expected) ? expected : [expected];
  useEffect(() => {
    if (loading) return;
    if (!role) {
      navigate({ to: "/auth" });
      return;
    }
    if (!list.includes(role)) {
      navigate({ to: rolePath[role] });
    }
  }, [role, loading, navigate, JSON.stringify(list)]);
  return { role, loading };
}
