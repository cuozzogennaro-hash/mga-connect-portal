export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bolle: {
        Row: {
          anno: number
          cliente_id: string
          created_at: string
          id: string
          imponibile: number
          iva: number
          note: string | null
          numero: number
          ordine_id: string | null
          pagato_il: string | null
          pdf_url: string | null
          stato_pagamento: Database["public"]["Enums"]["pagamento_stato"]
          totale: number
          updated_at: string
        }
        Insert: {
          anno?: number
          cliente_id: string
          created_at?: string
          id?: string
          imponibile?: number
          iva?: number
          note?: string | null
          numero: number
          ordine_id?: string | null
          pagato_il?: string | null
          pdf_url?: string | null
          stato_pagamento?: Database["public"]["Enums"]["pagamento_stato"]
          totale?: number
          updated_at?: string
        }
        Update: {
          anno?: number
          cliente_id?: string
          created_at?: string
          id?: string
          imponibile?: number
          iva?: number
          note?: string | null
          numero?: number
          ordine_id?: string | null
          pagato_il?: string | null
          pdf_url?: string | null
          stato_pagamento?: Database["public"]["Enums"]["pagamento_stato"]
          totale?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bolle_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bolle_ordine_id_fkey"
            columns: ["ordine_id"]
            isOneToOne: false
            referencedRelation: "ordini"
            referencedColumns: ["id"]
          },
        ]
      }
      bolle_righe: {
        Row: {
          bolla_id: string
          created_at: string
          descrizione: string
          id: string
          iva_perc: number | null
          posizione: number
          prezzo: number | null
          quantita: number | null
          totale_riga: number | null
        }
        Insert: {
          bolla_id: string
          created_at?: string
          descrizione: string
          id?: string
          iva_perc?: number | null
          posizione?: number
          prezzo?: number | null
          quantita?: number | null
          totale_riga?: number | null
        }
        Update: {
          bolla_id?: string
          created_at?: string
          descrizione?: string
          id?: string
          iva_perc?: number | null
          posizione?: number
          prezzo?: number | null
          quantita?: number | null
          totale_riga?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bolle_righe_bolla_id_fkey"
            columns: ["bolla_id"]
            isOneToOne: false
            referencedRelation: "bolle"
            referencedColumns: ["id"]
          },
        ]
      }
      ordini: {
        Row: {
          cliente_id: string
          created_at: string
          data_ritiro: string | null
          id: string
          note: string | null
          ocr_data: Json | null
          ocr_iva: number | null
          ocr_totale: number | null
          scontrino_url: string | null
          stato: Database["public"]["Enums"]["ordine_stato"]
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_ritiro?: string | null
          id?: string
          note?: string | null
          ocr_data?: Json | null
          ocr_iva?: number | null
          ocr_totale?: number | null
          scontrino_url?: string | null
          stato?: Database["public"]["Enums"]["ordine_stato"]
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_ritiro?: string | null
          id?: string
          note?: string | null
          ocr_data?: Json | null
          ocr_iva?: number | null
          ocr_totale?: number | null
          scontrino_url?: string | null
          stato?: Database["public"]["Enums"]["ordine_stato"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordini_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordini_righe: {
        Row: {
          created_at: string
          descrizione: string
          id: string
          note: string | null
          ordine_id: string
          posizione: number
          quantita: string | null
        }
        Insert: {
          created_at?: string
          descrizione: string
          id?: string
          note?: string | null
          ordine_id: string
          posizione?: number
          quantita?: string | null
        }
        Update: {
          created_at?: string
          descrizione?: string
          id?: string
          note?: string | null
          ordine_id?: string
          posizione?: number
          quantita?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordini_righe_ordine_id_fkey"
            columns: ["ordine_id"]
            isOneToOne: false
            referencedRelation: "ordini"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          indirizzo_consegna: string | null
          nome: string | null
          partita_iva: string | null
          ragione_sociale: string | null
          referente: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          indirizzo_consegna?: string | null
          nome?: string | null
          partita_iva?: string | null
          ragione_sociale?: string | null
          referente?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          indirizzo_consegna?: string | null
          nome?: string | null
          partita_iva?: string | null
          ragione_sociale?: string | null
          referente?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promozioni: {
        Row: {
          attiva: boolean
          created_at: string
          descrizione: string | null
          foto_url: string | null
          id: string
          prezzo_promo: number | null
          titolo: string
          updated_at: string
          valida_al: string | null
          valida_da: string | null
        }
        Insert: {
          attiva?: boolean
          created_at?: string
          descrizione?: string | null
          foto_url?: string | null
          id?: string
          prezzo_promo?: number | null
          titolo: string
          updated_at?: string
          valida_al?: string | null
          valida_da?: string | null
        }
        Update: {
          attiva?: boolean
          created_at?: string
          descrizione?: string | null
          foto_url?: string | null
          id?: string
          prezzo_promo?: number | null
          titolo?: string
          updated_at?: string
          valida_al?: string | null
          valida_da?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_bolla_numero: { Args: { _anno: number }; Returns: number }
    }
    Enums: {
      app_role: "cliente_b2b" | "operatore_preparazione" | "admin"
      ordine_stato: "nuovo" | "scontrinato" | "evaso" | "annullato"
      pagamento_stato: "in_attesa" | "pagato"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["cliente_b2b", "operatore_preparazione", "admin"],
      ordine_stato: ["nuovo", "scontrinato", "evaso", "annullato"],
      pagamento_stato: ["in_attesa", "pagato"],
    },
  },
} as const
