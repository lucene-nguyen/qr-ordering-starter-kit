// Generated from the Supabase schema of the DEV project – do not edit by hand. Regenerate after each
// migration: `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
// (linked = tabletap-dev, kozwhezqksupsstvunka; prod must match it), then re-add this header.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cart_items: {
        Row: {
          added_by: string
          addon_ids: string[]
          created_at: string
          id: string
          menu_item_id: string
          note: string | null
          qty: number
          session_id: string
          size_id: string | null
          updated_at: string
        }
        Insert: {
          added_by: string
          addon_ids?: string[]
          created_at?: string
          id?: string
          menu_item_id: string
          note?: string | null
          qty: number
          session_id: string
          size_id?: string | null
          updated_at?: string
        }
        Update: {
          added_by?: string
          addon_ids?: string[]
          created_at?: string
          id?: string
          menu_item_id?: string
          note?: string | null
          qty?: number
          session_id?: string
          size_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "session_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "menu_item_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          sort: number
        }
        Insert: {
          id?: string
          name: string
          sort?: number
        }
        Update: {
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      join_attempts: {
        Row: {
          created_at: string
          id: number
          ip: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          ip: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: never
          ip?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_attempts_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_addons: {
        Row: {
          extra_price: number
          id: string
          menu_item_id: string
          name: string
          sort: number
        }
        Insert: {
          extra_price?: number
          id?: string
          menu_item_id: string
          name: string
          sort?: number
        }
        Update: {
          extra_price?: number
          id?: string
          menu_item_id?: string
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_addons_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_sizes: {
        Row: {
          extra_price: number
          id: string
          menu_item_id: string
          name: string
          sort: number
        }
        Insert: {
          extra_price?: number
          id?: string
          menu_item_id: string
          name: string
          sort?: number
        }
        Update: {
          extra_price?: number
          id?: string
          menu_item_id?: string
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_sizes_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          is_popular: boolean
          name: string
          price: number
          sort: number
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name: string
          price: number
          sort?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          addons: Json
          id: string
          menu_item_id: string
          name_snapshot: string
          note: string | null
          order_id: string
          qty: number
          size_name: string | null
          unit_price: number
        }
        Insert: {
          addons?: Json
          id?: string
          menu_item_id: string
          name_snapshot: string
          note?: string | null
          order_id: string
          qty: number
          size_name?: string | null
          unit_price: number
        }
        Update: {
          addons?: Json
          id?: string
          menu_item_id?: string
          name_snapshot?: string
          note?: string | null
          order_id?: string
          qty?: number
          size_name?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          order_no: string
          placed_by: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          table_id: string
          total: number
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          order_no?: string
          placed_by?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id: string
          total: number
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          order_no?: string
          placed_by?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          table_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_placed_by_fkey"
            columns: ["placed_by"]
            isOneToOne: false
            referencedRelation: "session_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          guest_id: string | null
          id: string
          kind: string
          method: string
          payer_name: string | null
          reference: string | null
          session_id: string
          status: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          kind?: string
          method: string
          payer_name?: string | null
          reference?: string | null
          session_id: string
          status?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          guest_id?: string | null
          id?: string
          kind?: string
          method?: string
          payer_name?: string | null
          reference?: string | null
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "session_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          account_name: string
          account_no: string
          bank_bin: string
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_no: string
          bank_bin: string
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_no?: string
          bank_bin?: string
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_guests: {
        Row: {
          display_name: string
          id: string
          joined_at: string
          session_id: string
        }
        Insert: {
          display_name: string
          id?: string
          joined_at?: string
          session_id: string
        }
        Update: {
          display_name?: string
          id?: string
          joined_at?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_guests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          display_name: string
          role: string
          user_id: string
        }
        Insert: {
          display_name: string
          role: string
          user_id: string
        }
        Update: {
          display_name?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      table_sessions: {
        Row: {
          cart_version: number
          closed_at: string | null
          closed_by: string | null
          closed_reason: string | null
          id: string
          last_activity_at: string
          opened_at: string
          opened_by: string | null
          pin: string
          split_people: number | null
          status: string
          table_id: string
        }
        Insert: {
          cart_version?: number
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          id?: string
          last_activity_at?: string
          opened_at?: string
          opened_by?: string | null
          pin?: string
          split_people?: number | null
          status?: string
          table_id: string
        }
        Update: {
          cart_version?: number
          closed_at?: string | null
          closed_by?: string | null
          closed_reason?: string | null
          id?: string
          last_activity_at?: string
          opened_at?: string
          opened_by?: string | null
          pin?: string
          split_people?: number | null
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          code: string
          id: string
          is_active: boolean
          label: string
        }
        Insert: {
          code: string
          id?: string
          is_active?: boolean
          label: string
        }
        Update: {
          code?: string
          id?: string
          is_active?: boolean
          label?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_payment: {
        Args: { p_guest: string; p_table_code: string }
        Returns: undefined
      }
      cart_add: {
        Args: { p_guest: string; p_line: Json; p_table_code: string }
        Returns: number
      }
      cart_change: {
        Args: {
          p_delta: number
          p_guest: string
          p_item: string
          p_table_code: string
        }
        Returns: number
      }
      join_table: {
        Args: {
          p_ip: string
          p_name: string
          p_pin: string
          p_table_code: string
        }
        Returns: Json
      }
      place_order: {
        Args: { p_idempotency_key: string; p_lines: Json; p_table_code: string }
        Returns: Json
      }
      place_session_order: {
        Args: { p_cart_version: number; p_guest: string; p_table_code: string }
        Returns: Json
      }
      record_cash_payment: { Args: { p_session_id: string }; Returns: Json }
      request_payment: {
        Args: {
          p_guest: string
          p_mode: string
          p_people: number
          p_table_code: string
        }
        Returns: Json
      }
    }
    Enums: {
      order_status: "pending" | "preparing" | "ready" | "served" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      order_status: ["pending", "preparing", "ready", "served", "cancelled"],
    },
  },
} as const
