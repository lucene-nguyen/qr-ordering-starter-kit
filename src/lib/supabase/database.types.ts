// Generated from the Supabase schema of the DEV project – do not edit by hand. Regenerate after each
// migration with the Supabase MCP `generate_typescript_types` or
// `npx supabase gen types typescript --project-id kozwhezqksupsstvunka` (dev; prod must match it).

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
          id: string
          last_activity_at: string
          opened_at: string
          status: string
          table_id: string
        }
        Insert: {
          cart_version?: number
          closed_at?: string | null
          id?: string
          last_activity_at?: string
          opened_at?: string
          status?: string
          table_id: string
        }
        Update: {
          cart_version?: number
          closed_at?: string | null
          id?: string
          last_activity_at?: string
          opened_at?: string
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
        Args: { p_name: string; p_table_code: string }
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
    }
    Enums: {
      order_status: "pending" | "preparing" | "ready" | "served" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
