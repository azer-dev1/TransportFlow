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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      devices: {
        Row: {
          expo_push_token: string
          id: string
          user_id: string
        }
        Insert: {
          expo_push_token: string
          id?: string
          user_id: string
        }
        Update: {
          expo_push_token?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          id: string
          line_id: string | null
          muted: boolean
          stop_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          line_id?: string | null
          muted?: boolean
          stop_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          line_id?: string | null
          muted?: boolean
          stop_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      line_stops: {
        Row: {
          arrival_offset_minutes: number
          id: string
          line_id: string
          sequence_order: number
          stop_id: string
        }
        Insert: {
          arrival_offset_minutes?: number
          id?: string
          line_id: string
          sequence_order: number
          stop_id: string
        }
        Update: {
          arrival_offset_minutes?: number
          id?: string
          line_id?: string
          sequence_order?: number
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_stops_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_stops_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          created_at: string
          id: string
          mode: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          mode: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          mode?: string
          name?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          quiet_end: string | null
          quiet_start: string | null
          timezone: string
          user_id: string
        }
        Insert: {
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string
          user_id: string
        }
        Update: {
          quiet_end?: string | null
          quiet_start?: string | null
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          message: string
          read_at: string | null
          sent_at: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message: string
          read_at?: string | null
          sent_at?: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message?: string
          read_at?: string | null
          sent_at?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      service_alerts: {
        Row: {
          body: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          line_id: string
          severity: string
          starts_at: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          line_id: string
          severity?: string
          starts_at?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          line_id?: string
          severity?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_alerts_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
      service_patterns: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: number[]
          departure_time: string
          id: string
          line_id: string
          timezone: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          departure_time: string
          id?: string
          line_id: string
          timezone?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          departure_time?: string
          id?: string
          line_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_patterns_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          id: string
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          id?: string
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          id?: string
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      trip_updates: {
        Row: {
          created_at: string
          delay_minutes: number
          id: string
          reporter_id: string
          status: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          delay_minutes?: number
          id?: string
          reporter_id: string
          status: string
          trip_id: string
        }
        Update: {
          created_at?: string
          delay_minutes?: number
          id?: string
          reporter_id?: string
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_updates_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_updates_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          delay_minutes: number
          id: string
          line_id: string
          scheduled_departure: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          delay_minutes?: number
          id?: string
          line_id: string
          scheduled_departure: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          delay_minutes?: number
          id?: string
          line_id?: string
          scheduled_departure?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_updated_by_fkey"
            columns: ["updated_by"]
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
      complete_finished_trips: { Args: never; Returns: number }
      materialize_trips: { Args: { days_ahead?: number }; Returns: number }
      nearby_stops: {
        Args: { lat: number; lng: number; radius_m?: number }
        Returns: {
          distance_m: number
          id: string
          latitude: number
          longitude: number
          name: string
        }[]
      }
      promote_to_staff: { Args: { target_user_id: string }; Returns: undefined }
      search_lines: {
        Args: { max_results?: number; query: string }
        Returns: {
          id: string
          mode: string
          name: string
          rank: number
        }[]
      }
      search_stops: {
        Args: { max_results?: number; query: string }
        Returns: {
          id: string
          latitude: number
          longitude: number
          name: string
          rank: number
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
