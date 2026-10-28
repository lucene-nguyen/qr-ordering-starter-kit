// Generated from the Supabase schema (Supabase MCP `generate_typescript_types` or
// `npx supabase gen types typescript --project-id sxwcsxyalzblvkhtlola`). Regenerate after each migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ItemOption = { extra_price: number; id: string; menu_item_id: string; name: string; sort: number };
type ItemOptionInsert = { extra_price?: number; id?: string; menu_item_id: string; name: string; sort?: number };

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categories: {
        Row: { id: string; name: string; sort: number };
        Insert: { id?: string; name: string; sort?: number };
        Update: { id?: string; name?: string; sort?: number };
        Relationships: [];
      };
      menu_item_addons: {
        Row: ItemOption;
        Insert: ItemOptionInsert;
        Update: Partial<ItemOption>;
        Relationships: [
          {
            foreignKeyName: "menu_item_addons_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_item_sizes: {
        Row: ItemOption;
        Insert: ItemOptionInsert;
        Update: Partial<ItemOption>;
        Relationships: [
          {
            foreignKeyName: "menu_item_sizes_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
        ];
      };
      menu_items: {
        Row: {
          category_id: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          is_available: boolean;
          is_popular: boolean;
          name: string;
          price: number;
          sort: number;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          is_popular?: boolean;
          name: string;
          price: number;
          sort?: number;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          is_available?: boolean;
          is_popular?: boolean;
          name?: string;
          price?: number;
          sort?: number;
        };
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          addons: Json;
          id: string;
          menu_item_id: string;
          name_snapshot: string;
          note: string | null;
          order_id: string;
          qty: number;
          size_name: string | null;
          unit_price: number;
        };
        Insert: {
          addons?: Json;
          id?: string;
          menu_item_id: string;
          name_snapshot: string;
          note?: string | null;
          order_id: string;
          qty: number;
          size_name?: string | null;
          unit_price: number;
        };
        Update: {
          addons?: Json;
          id?: string;
          menu_item_id?: string;
          name_snapshot?: string;
          note?: string | null;
          order_id?: string;
          qty?: number;
          size_name?: string | null;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          id: string;
          idempotency_key: string;
          order_no: string;
          session_id: string | null;
          status: Database["public"]["Enums"]["order_status"];
          table_id: string;
          total: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idempotency_key: string;
          order_no?: string;
          session_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          table_id: string;
          total: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          order_no?: string;
          session_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          table_id?: string;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_profiles: {
        Row: { display_name: string; role: string; user_id: string };
        Insert: { display_name: string; role: string; user_id: string };
        Update: { display_name?: string; role?: string; user_id?: string };
        Relationships: [];
      };
      tables: {
        Row: { code: string; id: string; is_active: boolean; label: string };
        Insert: { code: string; id?: string; is_active?: boolean; label: string };
        Update: { code?: string; id?: string; is_active?: boolean; label?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      place_order: {
        Args: { p_idempotency_key: string; p_lines: Json; p_table_code: string };
        Returns: Json;
      };
    };
    Enums: {
      order_status: "pending" | "preparing" | "ready" | "served" | "cancelled";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
