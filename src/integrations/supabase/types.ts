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
      applicant_notes: {
        Row: {
          applicant_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          note: string
          note_type: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          note: string
          note_type?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          note?: string
          note_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicant_notes_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          address: string | null
          applicant_signature_date: string | null
          applicant_signature_status: boolean | null
          application_status: Database["public"]["Enums"]["application_status"]
          college_attending: string | null
          created_at: string
          email: string | null
          essay_url: string | null
          first_name: string
          ged_completion_date: string | null
          graduation_high_school: string | null
          guardian_signature_date: string | null
          guardian_signature_status: boolean | null
          has_essay: boolean | null
          has_transcript: boolean | null
          high_school_graduate_or_ged: string | null
          id: string
          is_18_or_older: boolean | null
          is_finalist: boolean | null
          is_selected: boolean | null
          last_name: string
          needs_follow_up: boolean | null
          phone: string | null
          preliminary_screening_status: Database["public"]["Enums"]["preliminary_screening_status"]
          rank: number | null
          review_status: Database["public"]["Enums"]["review_status"]
          submission_date: string | null
          total_score: number | null
          transcript_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          applicant_signature_date?: string | null
          applicant_signature_status?: boolean | null
          application_status?: Database["public"]["Enums"]["application_status"]
          college_attending?: string | null
          created_at?: string
          email?: string | null
          essay_url?: string | null
          first_name: string
          ged_completion_date?: string | null
          graduation_high_school?: string | null
          guardian_signature_date?: string | null
          guardian_signature_status?: boolean | null
          has_essay?: boolean | null
          has_transcript?: boolean | null
          high_school_graduate_or_ged?: string | null
          id?: string
          is_18_or_older?: boolean | null
          is_finalist?: boolean | null
          is_selected?: boolean | null
          last_name: string
          needs_follow_up?: boolean | null
          phone?: string | null
          preliminary_screening_status?: Database["public"]["Enums"]["preliminary_screening_status"]
          rank?: number | null
          review_status?: Database["public"]["Enums"]["review_status"]
          submission_date?: string | null
          total_score?: number | null
          transcript_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          applicant_signature_date?: string | null
          applicant_signature_status?: boolean | null
          application_status?: Database["public"]["Enums"]["application_status"]
          college_attending?: string | null
          created_at?: string
          email?: string | null
          essay_url?: string | null
          first_name?: string
          ged_completion_date?: string | null
          graduation_high_school?: string | null
          guardian_signature_date?: string | null
          guardian_signature_status?: boolean | null
          has_essay?: boolean | null
          has_transcript?: boolean | null
          high_school_graduate_or_ged?: string | null
          id?: string
          is_18_or_older?: boolean | null
          is_finalist?: boolean | null
          is_selected?: boolean | null
          last_name?: string
          needs_follow_up?: boolean | null
          phone?: string | null
          preliminary_screening_status?: Database["public"]["Enums"]["preliminary_screening_status"]
          rank?: number | null
          review_status?: Database["public"]["Enums"]["review_status"]
          submission_date?: string | null
          total_score?: number | null
          transcript_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_logs: {
        Row: {
          applicant_id: string
          contact_type: string
          contacted_at: string
          contacted_by: string | null
          contacted_by_name: string | null
          id: string
          message: string | null
          subject: string | null
        }
        Insert: {
          applicant_id: string
          contact_type: string
          contacted_at?: string
          contacted_by?: string | null
          contacted_by_name?: string | null
          id?: string
          message?: string | null
          subject?: string | null
        }
        Update: {
          applicant_id?: string
          contact_type?: string
          contacted_at?: string
          contacted_by?: string | null
          contacted_by_name?: string | null
          id?: string
          message?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_logs_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      reviewer_discussion_documents: {
        Row: {
          applicant_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          reviewer_email: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          uploaded_at: string
        }
        Insert: {
          applicant_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          reviewer_email?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          uploaded_at?: string
        }
        Update: {
          applicant_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          reviewer_email?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_discussion_documents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          applicant_id: string
          completeness_score: number | null
          created_at: string
          education_goals_score: number | null
          essay_score: number | null
          id: string
          is_complete: boolean
          mission_alignment_score: number | null
          personal_impact_score: number | null
          recommendation: Database["public"]["Enums"]["recommendation"] | null
          reviewer_id: string | null
          reviewer_name: string
          reviewer_notes: string | null
          rhetoric_score: number
          submitted_at: string | null
          total_score: number | null
          updated_at: string
          writing_score: number
        }
        Insert: {
          applicant_id: string
          completeness_score?: number | null
          created_at?: string
          education_goals_score?: number | null
          essay_score?: number | null
          id?: string
          is_complete?: boolean
          mission_alignment_score?: number | null
          personal_impact_score?: number | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          reviewer_id?: string | null
          reviewer_name: string
          reviewer_notes?: string | null
          rhetoric_score?: number
          submitted_at?: string | null
          total_score?: number | null
          updated_at?: string
          writing_score?: number
        }
        Update: {
          applicant_id?: string
          completeness_score?: number | null
          created_at?: string
          education_goals_score?: number | null
          essay_score?: number | null
          id?: string
          is_complete?: boolean
          mission_alignment_score?: number | null
          personal_impact_score?: number | null
          recommendation?: Database["public"]["Enums"]["recommendation"] | null
          reviewer_id?: string | null
          reviewer_name?: string
          reviewer_notes?: string | null
          rhetoric_score?: number
          submitted_at?: string | null
          total_score?: number | null
          updated_at?: string
          writing_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "applicants"
            referencedColumns: ["id"]
          },
        ]
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "reviewer" | "viewer"
      application_status:
        | "submitted"
        | "complete"
        | "incomplete"
        | "finalist"
        | "selected"
        | "not_selected"
        | "withdrawn"
      preliminary_screening_status:
        | "pending_screening"
        | "eligible_for_review"
        | "did_not_meet_minimum_requirements"
      recommendation:
        | "strongly_recommend"
        | "recommend"
        | "consider"
        | "needs_discussion"
        | "do_not_recommend"
      review_status:
        | "not_started"
        | "in_progress"
        | "reviewed"
        | "needs_discussion"
        | "follow_up"
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
      app_role: ["admin", "reviewer", "viewer"],
      application_status: [
        "submitted",
        "complete",
        "incomplete",
        "finalist",
        "selected",
        "not_selected",
        "withdrawn",
      ],
      preliminary_screening_status: [
        "pending_screening",
        "eligible_for_review",
        "did_not_meet_minimum_requirements",
      ],
      recommendation: [
        "strongly_recommend",
        "recommend",
        "consider",
        "needs_discussion",
        "do_not_recommend",
      ],
      review_status: [
        "not_started",
        "in_progress",
        "reviewed",
        "needs_discussion",
        "follow_up",
      ],
    },
  },
} as const
