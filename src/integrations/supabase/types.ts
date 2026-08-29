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
          application_id: string | null
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
          preliminary_screened_at: string | null
          preliminary_screened_by: string | null
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
          application_id?: string | null
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
          preliminary_screened_at?: string | null
          preliminary_screened_by?: string | null
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
          application_id?: string | null
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
          preliminary_screened_at?: string | null
          preliminary_screened_by?: string | null
          preliminary_screening_status?: Database["public"]["Enums"]["preliminary_screening_status"]
          rank?: number | null
          review_status?: Database["public"]["Enums"]["review_status"]
          submission_date?: string | null
          total_score?: number | null
          transcript_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applicants_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "portal_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applicants_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "program_rankings"
            referencedColumns: ["application_id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          content_type: string | null
          created_at: string
          external_url: string | null
          file_name: string | null
          id: string
          label: string
          storage_path: string | null
        }
        Insert: {
          application_id: string
          content_type?: string | null
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          label: string
          storage_path?: string | null
        }
        Update: {
          application_id?: string
          content_type?: string | null
          created_at?: string
          external_url?: string | null
          file_name?: string | null
          id?: string
          label?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "portal_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "program_rankings"
            referencedColumns: ["application_id"]
          },
        ]
      }
      business_grant_application_details: {
        Row: {
          additional_information: string | null
          amount_requested: number | null
          annual_revenue_range: string | null
          application_id: string
          business_address: string | null
          business_description: string | null
          business_name: string
          business_need: string | null
          business_structure: string | null
          community_impact: string | null
          contact_name: string | null
          contact_phone: string | null
          eligibility_answers: Json
          employee_count: number | null
          jobs_impact: string | null
          legal_business_name: string | null
          owner_background: string | null
          products_services: string | null
          proposed_use_of_funds: string | null
          raw_response: Json
          updated_at: string
          use_of_funds_breakdown: string | null
          website: string | null
          year_established: number | null
        }
        Insert: {
          additional_information?: string | null
          amount_requested?: number | null
          annual_revenue_range?: string | null
          application_id: string
          business_address?: string | null
          business_description?: string | null
          business_name: string
          business_need?: string | null
          business_structure?: string | null
          community_impact?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          eligibility_answers?: Json
          employee_count?: number | null
          jobs_impact?: string | null
          legal_business_name?: string | null
          owner_background?: string | null
          products_services?: string | null
          proposed_use_of_funds?: string | null
          raw_response?: Json
          updated_at?: string
          use_of_funds_breakdown?: string | null
          website?: string | null
          year_established?: number | null
        }
        Update: {
          additional_information?: string | null
          amount_requested?: number | null
          annual_revenue_range?: string | null
          application_id?: string
          business_address?: string | null
          business_description?: string | null
          business_name?: string
          business_need?: string | null
          business_structure?: string | null
          community_impact?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          eligibility_answers?: Json
          employee_count?: number | null
          jobs_impact?: string | null
          legal_business_name?: string | null
          owner_background?: string | null
          products_services?: string | null
          proposed_use_of_funds?: string | null
          raw_response?: Json
          updated_at?: string
          use_of_funds_breakdown?: string | null
          website?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_grant_application_details_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "portal_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_grant_application_details_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "program_rankings"
            referencedColumns: ["application_id"]
          },
        ]
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
      import_batches: {
        Row: {
          completed_at: string | null
          failed_count: number
          id: string
          imported_by: string
          imported_count: number
          program_id: string
          source: string
          source_file_name: string | null
          started_at: string
          updated_count: number
        }
        Insert: {
          completed_at?: string | null
          failed_count?: number
          id?: string
          imported_by: string
          imported_count?: number
          program_id: string
          source: string
          source_file_name?: string | null
          started_at?: string
          updated_count?: number
        }
        Update: {
          completed_at?: string | null
          failed_count?: number
          id?: string
          imported_by?: string
          imported_count?: number
          program_id?: string
          source?: string
          source_file_name?: string | null
          started_at?: string
          updated_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ];
      };
      import_batches: TableDefinition<
        {
          id: string;
          program_id: string;
          source: string;
          source_file_name: string | null;
          imported_by: string;
          started_at: string;
          completed_at: string | null;
          imported_count: number;
          updated_count: number;
          failed_count: number;
        },
        {
          id?: string;
          program_id: string;
          source: string;
          source_file_name?: string | null;
          imported_by: string;
          started_at?: string;
          completed_at?: string | null;
          imported_count?: number;
          updated_count?: number;
          failed_count?: number;
        }
      >;
      import_rows: TableDefinition<
        {
          id: string;
          batch_id: string;
          external_submission_id: string | null;
          application_id: string | null;
          row_number: number;
          status: Database["public"]["Enums"]["import_row_status"];
          error_message: string | null;
          created_at: string;
        },
        {
          id?: string;
          batch_id: string;
          external_submission_id?: string | null;
          application_id?: string | null;
          row_number: number;
          status: Database["public"]["Enums"]["import_row_status"];
          error_message?: string | null;
          created_at?: string;
        }
      >;
      program_data_sources: TableDefinition<
        {
          id: string;
          program_id: string;
          source_type: Database["public"]["Enums"]["program_data_source_type"];
          spreadsheet_id: string;
          spreadsheet_url: string;
          worksheet_name: string | null;
          worksheet_gid: string | null;
          sync_enabled: boolean;
          sync_interval_minutes: number;
          service_account_email: string | null;
          last_sync_at: string | null;
          last_sync_status: Database["public"]["Enums"]["program_sync_status"] | null;
          last_sync_summary: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          program_id: string;
          source_type?: Database["public"]["Enums"]["program_data_source_type"];
          spreadsheet_id: string;
          spreadsheet_url: string;
          worksheet_name?: string | null;
          worksheet_gid?: string | null;
          sync_enabled?: boolean;
          sync_interval_minutes?: number;
          service_account_email?: string | null;
          last_sync_at?: string | null;
          last_sync_status?: Database["public"]["Enums"]["program_sync_status"] | null;
          last_sync_summary?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      program_source_field_mappings: TableDefinition<
        { id: string; data_source_id: string; source_column: string; target_field: string; required: boolean; created_at: string; updated_at: string },
        { id?: string; data_source_id: string; source_column: string; target_field: string; required?: boolean; created_at?: string; updated_at?: string }
      >;
      program_sync_runs: TableDefinition<
        {
          id: string;
          data_source_id: string;
          triggered_by: string | null;
          trigger_type: string;
          status: Database["public"]["Enums"]["program_sync_status"];
          started_at: string;
          completed_at: string | null;
          rows_read: number;
          records_created: number;
          records_updated: number;
          records_skipped: number;
          records_failed: number;
          error_details: Json;
          created_at: string;
        },
        {
          id?: string;
          data_source_id: string;
          triggered_by?: string | null;
          trigger_type: string;
          status?: Database["public"]["Enums"]["program_sync_status"];
          started_at?: string;
          completed_at?: string | null;
          rows_read?: number;
          records_created?: number;
          records_updated?: number;
          records_skipped?: number;
          records_failed?: number;
          error_details?: Json;
          created_at?: string;
        }
      >;
      portal_applications: TableDefinition<
        {
          id: string;
          program_id: string;
          external_submission_id: string | null;
          submitted_at: string | null;
          applicant_name: string;
          applicant_email: string | null;
          status: Database["public"]["Enums"]["portal_application_status"];
          review_status: Database["public"]["Enums"]["portal_review_status"];
          completed_review_count: number;
          average_score: number;
          data_source_id: string | null;
          source_record_key: string | null;
          source_metadata: Json;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          program_id: string;
          external_submission_id?: string | null;
          submitted_at?: string | null;
          applicant_name: string;
          applicant_email?: string | null;
          status?: Database["public"]["Enums"]["portal_application_status"];
          review_status?: Database["public"]["Enums"]["portal_review_status"];
          completed_review_count?: number;
          average_score?: number;
          data_source_id?: string | null;
          source_record_key?: string | null;
          source_metadata?: Json;
          created_at?: string;
          updated_at?: string;
        }
      >;
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
      program_reviews: {
        Row: {
          application_id: string
          assignment_id: string
          created_at: string
          id: string
          program_id: string
          reviewer_comments: string | null
          reviewer_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["portal_review_status"]
          submitted_at: string | null
          total_score: number
          updated_at: string
        }
        Insert: {
          application_id: string
          assignment_id: string
          created_at?: string
          id?: string
          program_id: string
          reviewer_comments?: string | null
          reviewer_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["portal_review_status"]
          submitted_at?: string | null
          total_score?: number
          updated_at?: string
        }
        Update: {
          application_id?: string
          assignment_id?: string
          created_at?: string
          id?: string
          program_id?: string
          reviewer_comments?: string | null
          reviewer_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["portal_review_status"]
          submitted_at?: string | null
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "portal_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "program_rankings"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "program_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "reviewer_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_reviews_assignment_identity_fkey"
            columns: [
              "assignment_id",
              "application_id",
              "program_id",
              "reviewer_id",
            ]
            isOneToOne: false
            referencedRelation: "reviewer_assignments"
            referencedColumns: [
              "id",
              "application_id",
              "program_id",
              "reviewer_id",
            ]
          },
          {
            foreignKeyName: "program_reviews_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_scores: {
        Row: {
          created_at: string
          criterion_id: string
          id: string
          points: number
          review_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterion_id: string
          id?: string
          points: number
          review_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterion_id?: string
          id?: string
          points?: number
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "program_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviewer_assignments: {
        Row: {
          application_id: string
          assigned_at: string
          assigned_by: string | null
          due_at: string | null
          id: string
          program_id: string
          reviewer_id: string
        }
        Insert: {
          application_id: string
          assigned_at?: string
          assigned_by?: string | null
          due_at?: string | null
          id?: string
          program_id: string
          reviewer_id: string
        }
        Update: {
          application_id?: string
          assigned_at?: string
          assigned_by?: string | null
          due_at?: string | null
          id?: string
          program_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviewer_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "portal_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviewer_assignments_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "program_rankings"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "reviewer_assignments_application_program_fkey"
            columns: ["application_id", "program_id"]
            isOneToOne: false
            referencedRelation: "portal_applications"
            referencedColumns: ["id", "program_id"]
          },
          {
            foreignKeyName: "reviewer_assignments_application_program_fkey"
            columns: ["application_id", "program_id"]
            isOneToOne: false
            referencedRelation: "program_rankings"
            referencedColumns: ["application_id", "program_id"]
          },
          {
            foreignKeyName: "reviewer_assignments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
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
      rubric_criteria: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          maximum_points: number
          name: string
          program_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          maximum_points: number
          name: string
          program_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          maximum_points?: number
          name?: string
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_program_access: {
        Row: {
          access_role: Database["public"]["Enums"]["program_access_role"]
          created_at: string
          id: string
          program_id: string
          user_id: string
        }
        Insert: {
          access_role: Database["public"]["Enums"]["program_access_role"]
          created_at?: string
          id?: string
          program_id: string
          user_id: string
        }
        Update: {
          access_role?: Database["public"]["Enums"]["program_access_role"]
          created_at?: string
          id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_access_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
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
      program_rankings: {
        Row: {
          applicant_name: string | null
          application_id: string | null
          average_score: number | null
          completed_review_count: number | null
          display_name: string | null
          program_id: string | null
          rank: number | null
          review_status:
            | Database["public"]["Enums"]["portal_review_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      app_role: "admin" | "reviewer" | "viewer";
      import_row_status: "imported" | "updated" | "failed";
      program_data_source_type: "google_sheets";
      program_sync_status: "pending" | "running" | "completed" | "partial" | "failed";
      portal_application_status: "submitted" | "complete" | "incomplete" | "withdrawn";
      portal_review_status: "not_started" | "in_progress" | "completed";
      program_access_role: "admin" | "reviewer" | "viewer";
      application_status:
        | "submitted"
        | "complete"
        | "incomplete"
        | "finalist"
        | "selected"
        | "not_selected"
        | "withdrawn"
      import_row_status: "imported" | "updated" | "failed"
      portal_application_status:
        | "submitted"
        | "complete"
        | "incomplete"
        | "withdrawn"
      portal_review_status: "not_started" | "in_progress" | "completed"
      preliminary_screening_status:
        | "pending_screening"
        | "eligible_for_review"
        | "did_not_meet_minimum_requirements"
      program_access_role: "admin" | "reviewer" | "viewer"
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
      import_row_status: ["imported", "updated", "failed"],
      program_data_source_type: ["google_sheets"],
      program_sync_status: ["pending", "running", "completed", "partial", "failed"],
      portal_application_status: ["submitted", "complete", "incomplete", "withdrawn"],
      portal_review_status: ["not_started", "in_progress", "completed"],
      program_access_role: ["admin", "reviewer", "viewer"],
      application_status: [
        "submitted",
        "complete",
        "incomplete",
        "finalist",
        "selected",
        "not_selected",
        "withdrawn",
      ],
      import_row_status: ["imported", "updated", "failed"],
      portal_application_status: [
        "submitted",
        "complete",
        "incomplete",
        "withdrawn",
      ],
      portal_review_status: ["not_started", "in_progress", "completed"],
      preliminary_screening_status: [
        "pending_screening",
        "eligible_for_review",
        "did_not_meet_minimum_requirements",
      ],
      program_access_role: ["admin", "reviewer", "viewer"],
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
