// Generated from the Supabase schema (Supabase MCP `generate_typescript_types` or
// `npx supabase gen types typescript --project-id sxwcsxyalzblvkhtlola`). Regenerate after each migration.

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
      tables: {
        Row: { code: string; id: string; is_active: boolean; label: string };
        Insert: { code: string; id?: string; is_active?: boolean; label: string };
        Update: { code?: string; id?: string; is_active?: boolean; label?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
