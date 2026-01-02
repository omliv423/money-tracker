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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          current_balance: number | null
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          owner: string
          type: string
          user_id: string | null
          opening_balance: number
          balance_date: string | null
        }
        Insert: {
          created_at?: string
          current_balance?: number | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          owner?: string
          type: string
          user_id?: string | null
          opening_balance?: number
          balance_date?: string | null
        }
        Update: {
          created_at?: string
          current_balance?: number | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          owner?: string
          type?: string
          user_id?: string | null
          opening_balance?: number
          balance_date?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      counterparties: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          id: string
          name: string
          description: string | null
          account_id: string | null
          total_amount: number
          day_of_month: number | null
          payment_delay_days: number
          is_active: boolean
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          account_id?: string | null
          total_amount: number
          day_of_month?: number | null
          payment_delay_days?: number
          is_active?: boolean
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          account_id?: string | null
          total_amount?: number
          day_of_month?: number | null
          payment_delay_days?: number
          is_active?: boolean
          created_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          }
        ]
      }
      recurring_transaction_lines: {
        Row: {
          id: string
          recurring_transaction_id: string
          amount: number
          category_id: string | null
          line_type: string
          counterparty: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recurring_transaction_id: string
          amount: number
          category_id?: string | null
          line_type: string
          counterparty?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recurring_transaction_id?: string
          amount?: number
          category_id?: string | null
          line_type?: string
          counterparty?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transaction_lines_recurring_transaction_id_fkey"
            columns: ["recurring_transaction_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transaction_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      quick_entries: {
        Row: {
          id: string
          name: string
          description: string | null
          account_id: string | null
          category_id: string | null
          line_type: string
          counterparty: string | null
          is_active: boolean
          use_count: number
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          account_id?: string | null
          category_id?: string | null
          line_type?: string
          counterparty?: string | null
          is_active?: boolean
          use_count?: number
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          account_id?: string | null
          category_id?: string | null
          line_type?: string
          counterparty?: string | null
          is_active?: boolean
          use_count?: number
          created_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      budgets: {
        Row: {
          id: string
          category_id: string | null
          monthly_amount: number
          is_active: boolean
          created_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          category_id?: string | null
          monthly_amount: number
          is_active?: boolean
          created_at?: string
          user_id?: string | null
        }
        Update: {
          id?: string
          category_id?: string | null
          monthly_amount?: number
          is_active?: boolean
          created_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      balance_items: {
        Row: {
          id: string
          user_id: string | null
          name: string
          item_type: string
          category: string | null
          balance: number
          balance_date: string | null
          note: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          item_type: string
          category?: string | null
          balance?: number
          balance_date?: string | null
          note?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          item_type?: string
          category?: string | null
          balance?: number
          balance_date?: string | null
          note?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount: number
          counterparty: string
          created_at: string
          date: string
          id: string
          note: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          counterparty: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          counterparty?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      households: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name?: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      household_members: {
        Row: {
          id: string
          household_id: string
          user_id: string | null
          role: string
          invited_email: string | null
          invite_token: string | null
          invited_at: string
          joined_at: string | null
          status: string
        }
        Insert: {
          id?: string
          household_id: string
          user_id?: string | null
          role?: string
          invited_email?: string | null
          invite_token?: string | null
          invited_at?: string
          joined_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          household_id?: string
          user_id?: string | null
          role?: string
          invited_email?: string | null
          invite_token?: string | null
          invited_at?: string
          joined_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          }
        ]
      }
      transaction_lines: {
        Row: {
          amortization_end: string | null
          amortization_months: number | null
          amortization_start: string | null
          amount: number
          category_id: string | null
          counterparty: string | null
          created_at: string
          id: string
          is_settled: boolean
          line_type: string
          note: string | null
          settled_amount: number | null
          transaction_id: string
        }
        Insert: {
          amortization_end?: string | null
          amortization_months?: number | null
          amortization_start?: string | null
          amount: number
          category_id?: string | null
          counterparty?: string | null
          created_at?: string
          id?: string
          is_settled?: boolean
          line_type: string
          note?: string | null
          settled_amount?: number | null
          transaction_id: string
        }
        Update: {
          amortization_end?: string | null
          amortization_months?: number | null
          amortization_start?: string | null
          amount?: number
          category_id?: string | null
          counterparty?: string | null
          created_at?: string
          id?: string
          is_settled?: boolean
          line_type?: string
          note?: string | null
          settled_amount?: number | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_lines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_lines_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          counterparty_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          is_cash_settled: boolean | null
          payment_date: string | null
          settled_amount: number | null
          total_amount: number
          user_id: string | null
        }
        Insert: {
          account_id: string
          counterparty_id?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          is_cash_settled?: boolean | null
          payment_date?: string | null
          settled_amount?: number | null
          total_amount: number
          user_id?: string | null
        }
        Update: {
          account_id?: string
          counterparty_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          is_cash_settled?: boolean | null
          payment_date?: string | null
          settled_amount?: number | null
          total_amount?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "counterparties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
