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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_errors: {
        Row: {
          bot_id: string
          created_at: string | null
          error_message: string | null
          id: string
          node_name: string | null
          user_message: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          node_name?: string | null
          user_message?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          node_name?: string | null
          user_message?: string | null
        }
        Relationships: []
      }
      chatbots: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          id: string
          model: string | null
          name: string | null
          project_id: string
          temperature: number | null
          user_id: string | null
          welcome_message: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          id?: string
          model?: string | null
          name?: string | null
          project_id?: string
          temperature?: number | null
          user_id?: string | null
          welcome_message?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          id?: string
          model?: string | null
          name?: string | null
          project_id?: string
          temperature?: number | null
          user_id?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number | null
          created_at: string | null
          id: string
          partner_id: string
          payout_date: string | null
          referral_id: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          id?: string
          partner_id: string
          payout_date?: string | null
          referral_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          id?: string
          partner_id?: string
          payout_date?: string | null
          referral_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          chatbot_id: string
          created_at: string | null
          id: string
          visitor_id: string | null
        }
        Insert: {
          chatbot_id: string
          created_at?: string | null
          id?: string
          visitor_id?: string | null
        }
        Update: {
          chatbot_id?: string
          created_at?: string | null
          id?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      domains: {
        Row: {
          bot_id: string
          created_at: string | null
          domain: string | null
          id: string
        }
        Insert: {
          bot_id?: string
          created_at?: string | null
          domain?: string | null
          id?: string
        }
        Update: {
          bot_id?: string
          created_at?: string | null
          domain?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_chatbot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "chatbots"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          answer: string | null
          chatbot_id: string
          content: string | null
          created_at: string | null
          id: string
          question: string | null
          source: string | null
          title: string | null
        }
        Insert: {
          answer?: string | null
          chatbot_id: string
          content?: string | null
          created_at?: string | null
          id?: string
          question?: string | null
          source?: string | null
          title?: string | null
        }
        Update: {
          answer?: string | null
          chatbot_id?: string
          content?: string | null
          created_at?: string | null
          id?: string
          question?: string | null
          source?: string | null
          title?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          budget: string | null
          chat: string | null
          chatbot_id: string | null
          conversation_id: string | null
          created_at: string | null
          email: string | null
          id: string
          leads_status: string | null
          message: string | null
          name: string | null
          phone: string | null
          service: string | null
        }
        Insert: {
          budget?: string | null
          chat?: string | null
          chatbot_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          leads_status?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          service?: string | null
        }
        Update: {
          budget?: string | null
          chat?: string | null
          chatbot_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          leads_status?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          service?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          bot_id: string | null
          calendar_id: string | null
          content: string | null
          conversation_id: string
          created_at: string | null
          id: string
          phone: number | null
          role: string | null
        }
        Insert: {
          bot_id?: string | null
          calendar_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          phone?: number | null
          role?: string | null
        }
        Update: {
          bot_id?: string | null
          calendar_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          phone?: number | null
          role?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          bot_id: string | null
          created_at: string | null
          customer_email: string | null
          id: string
          lead_id: string | null
          payment_id: string | null
          payment_status: string | null
          payu_data: Json | null
          price: number | null
          product_name: string | null
          user_id: string
        }
        Insert: {
          bot_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          id: string
          lead_id?: string | null
          payment_id?: string | null
          payment_status?: string | null
          payu_data?: Json | null
          price?: number | null
          product_name?: string | null
          user_id: string
        }
        Update: {
          bot_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          id?: string
          lead_id?: string | null
          payment_id?: string | null
          payment_status?: string | null
          payu_data?: Json | null
          price?: number | null
          product_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          business_name: string | null
          commission_rate: number | null
          id: string
          referral_code: string | null
          user_id: string
        }
        Insert: {
          business_name?: string | null
          commission_rate?: number | null
          id?: string
          referral_code?: string | null
          user_id: string
        }
        Update: {
          business_name?: string | null
          commission_rate?: number | null
          id?: string
          referral_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          chatbot_limits: number | null
          created_at: string | null
          id: string
          message_limit: number | null
          name: string
          price: number | null
        }
        Insert: {
          chatbot_limits?: number | null
          created_at?: string | null
          id?: string
          message_limit?: number | null
          name: string
          price?: number | null
        }
        Update: {
          chatbot_limits?: number | null
          created_at?: string | null
          id?: string
          message_limit?: number | null
          name?: string
          price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          payu_is_active: boolean | null
          payu_merchant_key: string | null
          payu_merchant_salt: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          payu_is_active?: boolean | null
          payu_merchant_key?: string | null
          payu_merchant_salt?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          payu_is_active?: boolean | null
          payu_merchant_key?: string | null
          payu_merchant_salt?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          partner_id: string
          referred_email: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          partner_id: string
          referred_email?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          partner_id?: string
          referred_email?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle_end: string | null
          billing_cycle_start: string | null
          calendar_id: string | null
          chatbot_limit: number | null
          created_at: string
          email: string | null
          id: string
          message_limit: number | null
          message_used: number | null
          messages_reset_at: string | null
          plan: string | null
          plan_expiry: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          calendar_id?: string | null
          chatbot_limit?: number | null
          created_at?: string
          email?: string | null
          id?: string
          message_limit?: number | null
          message_used?: number | null
          messages_reset_at?: string | null
          plan?: string | null
          plan_expiry?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          calendar_id?: string | null
          chatbot_limit?: number | null
          created_at?: string
          email?: string | null
          id?: string
          message_limit?: number | null
          message_used?: number | null
          messages_reset_at?: string | null
          plan?: string | null
          plan_expiry?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
