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
      app_settings: {
        Row: {
          cooldown_minutes: number
          correction_window_days: number
          dtr_fill_break_times: boolean
          geofence_radius_m: number
          heartbeat_interval_seconds: number
          id: number
          max_gps_accuracy_m: number
          office_address: string
          office_name: string
          overnight_cutoff_hour: number
          selfie_required: boolean
          selfie_retention_days: number
          token_lifetime_seconds: number
          token_refresh_seconds: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cooldown_minutes?: number
          correction_window_days?: number
          dtr_fill_break_times?: boolean
          geofence_radius_m?: number
          heartbeat_interval_seconds?: number
          id?: number
          max_gps_accuracy_m?: number
          office_address?: string
          office_name?: string
          overnight_cutoff_hour?: number
          selfie_required?: boolean
          selfie_retention_days?: number
          token_lifetime_seconds?: number
          token_refresh_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cooldown_minutes?: number
          correction_window_days?: number
          dtr_fill_break_times?: boolean
          geofence_radius_m?: number
          heartbeat_interval_seconds?: number
          id?: number
          max_gps_accuracy_m?: number
          office_address?: string
          office_name?: string
          overnight_cutoff_hour?: number
          selfie_required?: boolean
          selfie_retention_days?: number
          token_lifetime_seconds?: number
          token_refresh_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          method: Database["public"]["Enums"]["attendance_method"]
          minutes_late: number
          notes: string | null
          station_id: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          time_in: string | null
          time_in_scan_id: string | null
          time_out: string | null
          time_out_scan_id: string | null
          undertime_minutes: number
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          method: Database["public"]["Enums"]["attendance_method"]
          minutes_late?: number
          notes?: string | null
          station_id?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          time_in?: string | null
          time_in_scan_id?: string | null
          time_out?: string | null
          time_out_scan_id?: string | null
          undertime_minutes?: number
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          method?: Database["public"]["Enums"]["attendance_method"]
          minutes_late?: number
          notes?: string | null
          station_id?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          time_in?: string | null
          time_in_scan_id?: string | null
          time_out?: string | null
          time_out_scan_id?: string | null
          undertime_minutes?: number
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_time_in_scan_id_fkey"
            columns: ["time_in_scan_id"]
            isOneToOne: false
            referencedRelation: "scan_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_time_out_scan_id_fkey"
            columns: ["time_out_scan_id"]
            isOneToOne: false
            referencedRelation: "scan_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      correction_requests: {
        Row: {
          attachment_url: string | null
          attendance_record_id: string | null
          created_at: string
          employee_id: string
          id: string
          reason: string
          remarks: string | null
          requested_time_in: string | null
          requested_time_out: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["correction_status"]
          type: Database["public"]["Enums"]["correction_type"]
          updated_at: string
          work_date: string
        }
        Insert: {
          attachment_url?: string | null
          attendance_record_id?: string | null
          created_at?: string
          employee_id: string
          id?: string
          reason: string
          remarks?: string | null
          requested_time_in?: string | null
          requested_time_out?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          type: Database["public"]["Enums"]["correction_type"]
          updated_at?: string
          work_date: string
        }
        Update: {
          attachment_url?: string | null
          attendance_record_id?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string
          remarks?: string | null
          requested_time_in?: string | null
          requested_time_out?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_status"]
          type?: Database["public"]["Enums"]["correction_type"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_requests_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          bound_at: string
          device_id_hash: string
          employee_id: string
          id: string
          model: string | null
          platform: Database["public"]["Enums"]["device_platform"]
          revoked_at: string | null
        }
        Insert: {
          bound_at?: string
          device_id_hash: string
          employee_id: string
          id?: string
          model?: string | null
          platform: Database["public"]["Enums"]["device_platform"]
          revoked_at?: string | null
        }
        Update: {
          bound_at?: string
          device_id_hash?: string
          employee_id?: string
          id?: string
          model?: string | null
          platform?: Database["public"]["Enums"]["device_platform"]
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "devices_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_schedules: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          employee_id: string
          schedule_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          employee_id: string
          schedule_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_schedules_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          severity: Database["public"]["Enums"]["error_severity"]
          source: Database["public"]["Enums"]["error_source"]
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          severity: Database["public"]["Enums"]["error_severity"]
          source: Database["public"]["Enums"]["error_source"]
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          severity?: Database["public"]["Enums"]["error_severity"]
          source?: Database["public"]["Enums"]["error_source"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          date: string
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          name?: string
        }
        Relationships: []
      }
      kiosk_heartbeats: {
        Row: {
          app_version: string
          clock_drift_ms: number
          created_at: string
          id: string
          last_token_at: string | null
          station_id: string
        }
        Insert: {
          app_version: string
          clock_drift_ms: number
          created_at?: string
          id?: string
          last_token_at?: string | null
          station_id: string
        }
        Update: {
          app_version?: string
          clock_drift_ms?: number
          created_at?: string
          id?: string
          last_token_at?: string | null
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_heartbeats_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
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
          address_enc: string | null
          approved_at: string | null
          approved_by: string | null
          area: string | null
          bhw_id_number: string | null
          consent_at: string | null
          contact_number_enc: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          photo_url: string | null
          rejection_reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          address_enc?: string | null
          approved_at?: string | null
          approved_by?: string | null
          area?: string | null
          bhw_id_number?: string | null
          consent_at?: string | null
          contact_number_enc?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          photo_url?: string | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          address_enc?: string | null
          approved_at?: string | null
          approved_by?: string | null
          area?: string | null
          bhw_id_number?: string | null
          consent_at?: string | null
          contact_number_enc?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          photo_url?: string | null
          rejection_reason?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_nonce_uses: {
        Row: {
          employee_id: string
          nonce: string
          used_at: string
        }
        Insert: {
          employee_id: string
          nonce: string
          used_at?: string
        }
        Update: {
          employee_id?: string
          nonce?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_nonce_uses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_nonces: {
        Row: {
          expires_at: string
          issued_at: string
          nonce: string
          station_id: string
        }
        Insert: {
          expires_at: string
          issued_at?: string
          nonce: string
          station_id: string
        }
        Update: {
          expires_at?: string
          issued_at?: string
          nonce?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_nonces_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_attempts: {
        Row: {
          accuracy: number | null
          created_at: string
          device_id_hash: string | null
          employee_id: string | null
          error_code: string | null
          failure_reason: string | null
          id: string
          lat: number | null
          lng: number | null
          nonce: string | null
          selfie_path: string | null
          station_id: string | null
          success: boolean
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          device_id_hash?: string | null
          employee_id?: string | null
          error_code?: string | null
          failure_reason?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nonce?: string | null
          selfie_path?: string | null
          station_id?: string | null
          success: boolean
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          device_id_hash?: string | null
          employee_id?: string | null
          error_code?: string | null
          failure_reason?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          nonce?: string | null
          selfie_path?: string | null
          station_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scan_attempts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_attempts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          break_end: string
          break_start: string
          created_at: string
          created_by: string | null
          end_time: string
          grace_minutes: number
          id: string
          name: string
          start_time: string
          updated_at: string
          work_days: number[]
        }
        Insert: {
          break_end?: string
          break_start?: string
          created_at?: string
          created_by?: string | null
          end_time: string
          grace_minutes?: number
          id?: string
          name: string
          start_time: string
          updated_at?: string
          work_days: number[]
        }
        Update: {
          break_end?: string
          break_start?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          grace_minutes?: number
          id?: string
          name?: string
          start_time?: string
          updated_at?: string
          work_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "schedules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_online: boolean
          kiosk_user_id: string | null
          last_seen_at: string | null
          latitude: number
          longitude: number
          name: string
          radius_m: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          kiosk_user_id?: string | null
          last_seen_at?: string | null
          latitude: number
          longitude: number
          name: string
          radius_m?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_online?: boolean
          kiosk_user_id?: string | null
          last_seen_at?: string | null
          latitude?: number
          longitude?: number
          name?: string
          radius_m?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_kiosk_user_id_fkey"
            columns: ["kiosk_user_id"]
            isOneToOne: true
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
      app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      apply_punch: {
        Args: {
          p_actor: string
          p_at: string
          p_employee_id: string
          p_method: Database["public"]["Enums"]["attendance_method"]
          p_notes?: string
          p_scan_id: string
          p_station_id: string
        }
        Returns: Json
      }
      approve_employee: {
        Args: {
          p_effective_from?: string
          p_employee_id: string
          p_schedule_id: string
        }
        Returns: undefined
      }
      assert_admin: { Args: never; Returns: undefined }
      assert_report_reader: { Args: never; Returns: undefined }
      assign_schedule: {
        Args: {
          p_effective_from: string
          p_employee_id: string
          p_schedule_id: string
        }
        Returns: undefined
      }
      audit_redact: { Args: { p_other: Json; p_row: Json }; Returns: Json }
      bind_device: {
        Args: {
          p_device_hash: string
          p_employee_id: string
          p_model: string
          p_platform: Database["public"]["Enums"]["device_platform"]
        }
        Returns: Json
      }
      cancel_correction_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      check_device: {
        Args: { p_device_hash: string; p_employee_id: string }
        Returns: string
      }
      check_registration_available: {
        Args: { p_bhw_id_number: string; p_email: string }
        Returns: string
      }
      cleanup_nonces: { Args: never; Returns: undefined }
      compute_attendance_status: {
        Args: {
          p_day_closed?: boolean
          p_employee_id: string
          p_time_in: string
          p_time_out: string
          p_work_date: string
        }
        Returns: Record<string, unknown>
      }
      correction_date_eligible: {
        Args: { p_work_date: string }
        Returns: boolean
      }
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      deactivate_employee: {
        Args: { p_employee_id: string; p_reason: string }
        Returns: undefined
      }
      decrypt_pii: { Args: { p_value: string }; Returns: string }
      detect_offline_kiosks: { Args: never; Returns: number }
      dtr_document: {
        Args: { p_employee_id: string; p_month: number; p_year: number }
        Returns: Json
      }
      dtr_month: {
        Args: { p_employee_id: string; p_month: number; p_year: number }
        Returns: Database["public"]["CompositeTypes"]["dtr_row"][]
        SetofOptions: {
          from: "*"
          to: "dtr_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      encrypt_pii: { Args: { p_value: string }; Returns: string }
      end_of_day_cron: { Args: { p_cutoff_hour: number }; Returns: string }
      file_correction_request: {
        Args: {
          p_attachment_path?: string
          p_reason: string
          p_time_in: string
          p_time_out: string
          p_type: Database["public"]["Enums"]["correction_type"]
          p_work_date: string
        }
        Returns: string
      }
      get_active_stations: {
        Args: never
        Returns: {
          id: string
          latitude: number
          longitude: number
          name: string
          radius_m: number
        }[]
      }
      get_attendance_trend: {
        Args: { p_days?: number }
        Returns: {
          absent: number
          incomplete: number
          late: number
          on_time: number
          undertime: number
          work_date: string
        }[]
      }
      get_daily_summary: {
        Args: {
          p_area?: string
          p_date: string
          p_status?: Database["public"]["Enums"]["attendance_status"]
        }
        Returns: {
          area: string
          bhw_id_number: string
          employee_id: string
          full_name: string
          method: Database["public"]["Enums"]["attendance_method"]
          minutes_late: number
          station_name: string
          status: Database["public"]["Enums"]["attendance_status"]
          time_in: string
          time_out: string
          undertime_minutes: number
          work_date: string
        }[]
      }
      get_dashboard_today: {
        Args: never
        Returns: {
          absent_count: number
          critical_errors_24h: number
          incomplete_count: number
          late_count: number
          no_record_yet_count: number
          offline_stations: number
          on_time_count: number
          pending_corrections: number
          pending_registrations: number
          present_count: number
          total_employees: number
          undertime_count: number
          work_date: string
        }[]
      }
      get_dtr: {
        Args: { p_employee_id: string; p_month: number; p_year: number }
        Returns: Json
      }
      get_dtr_batch: {
        Args: { p_month: number; p_year: number }
        Returns: Json
      }
      get_employee_history: {
        Args: { p_employee_id: string; p_from: string; p_to: string }
        Returns: {
          id: string
          method: Database["public"]["Enums"]["attendance_method"]
          minutes_late: number
          notes: string
          pending_correction: boolean
          station_name: string
          status: Database["public"]["Enums"]["attendance_status"]
          time_in: string
          time_out: string
          undertime_minutes: number
          work_date: string
        }[]
      }
      get_kiosk_feed: {
        Args: { p_limit?: number; p_station_id: string }
        Returns: {
          action: string
          at_time: string
          first_name: string
          status: Database["public"]["Enums"]["attendance_status"]
        }[]
      }
      get_monthly_summary: {
        Args: { p_area?: string; p_month: number; p_year: number }
        Returns: {
          absent_days: number
          area: string
          bhw_id_number: string
          days_present: number
          employee_id: string
          full_name: string
          incomplete_days: number
          late_days: number
          on_time_days: number
          scheduled_work_days: number
          total_minutes_late: number
          total_undertime_minutes: number
          undertime_days: number
        }[]
      }
      get_profile_private: {
        Args: { p_profile_id: string }
        Returns: {
          address: string
          contact_number: string
        }[]
      }
      get_report_areas: {
        Args: never
        Returns: {
          area: string
        }[]
      }
      get_weekly_summary: {
        Args: { p_area?: string; p_week_start: string }
        Returns: {
          absent_days: number
          area: string
          daily_status: Database["public"]["Enums"]["attendance_status"][]
          employee_id: string
          full_name: string
          incomplete_days: number
          late_days: number
          on_time_days: number
          total_minutes_late: number
          total_undertime_minutes: number
          undertime_days: number
          week_end: string
          week_start: string
        }[]
      }
      haversine_distance_m: {
        Args: { p_lat1: number; p_lat2: number; p_lng1: number; p_lng2: number }
        Returns: number
      }
      is_active_employee: { Args: { p_user?: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_viewer_or_admin: { Args: never; Returns: boolean }
      is_work_day: {
        Args: { p_date: string; p_employee_id: string }
        Returns: boolean
      }
      list_pending_registrations: {
        Args: never
        Returns: {
          area: string
          bhw_id_number: string
          consent_at: string
          created_at: string
          email: string
          email_confirmed_at: string
          full_name: string
          id: string
          photo_url: string
        }[]
      }
      log_error_internal: {
        Args: {
          p_context?: Json
          p_message: string
          p_severity: Database["public"]["Enums"]["error_severity"]
          p_source: Database["public"]["Enums"]["error_source"]
          p_user_id?: string
        }
        Returns: undefined
      }
      log_scan_attempt: {
        Args: {
          p_accuracy: number
          p_code: string
          p_device_hash: string
          p_employee_id: string
          p_lat: number
          p_lng: number
          p_nonce: string
          p_reason: string
          p_selfie_path: string
          p_station_id: string
        }
        Returns: string
      }
      manila_minute: { Args: { p_ts: string }; Returns: string }
      manila_today: { Args: never; Returns: string }
      manila_ts: { Args: { p_date: string; p_time: string }; Returns: string }
      manual_attendance_entry: {
        Args: {
          p_employee_id: string
          p_reason: string
          p_station_id?: string
          p_time_in: string
          p_time_out: string
          p_work_date: string
        }
        Returns: string
      }
      notify_admins: {
        Args: {
          p_body: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_title: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          p_body: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      pii_key: { Args: never; Returns: string }
      reactivate_employee: {
        Args: { p_employee_id: string }
        Returns: undefined
      }
      recompute_attendance: {
        Args: { p_employee_id?: string; p_from: string; p_to: string }
        Returns: number
      }
      record_device_sync_event: {
        Args: {
          p_bhw_id_number: string
          p_event_id: string
          p_occurred_at: string
          p_station_id: string
        }
        Returns: Json
      }
      record_fallback_scan: {
        Args: {
          p_admin_id: string
          p_employee_id: string
          p_nonce: string
          p_station_id: string
          p_token_expired: boolean
          p_token_valid: boolean
        }
        Returns: Json
      }
      record_heartbeat: {
        Args: {
          p_app_version: string
          p_client_now_ms: number
          p_kiosk_user: string
          p_last_token_at_ms: number
          p_station_id: string
        }
        Returns: Json
      }
      record_scan: {
        Args: {
          p_accuracy: number
          p_device_hash: string
          p_employee_id: string
          p_lat: number
          p_lng: number
          p_nonce: string
          p_selfie_path?: string
          p_station_id: string
          p_token_expired: boolean
          p_token_valid: boolean
        }
        Returns: Json
      }
      register_qr_nonce: {
        Args: {
          p_kiosk_user: string
          p_lifetime_seconds: number
          p_nonce: string
          p_station_id: string
        }
        Returns: Json
      }
      reject_employee: {
        Args: { p_employee_id: string; p_reason: string }
        Returns: undefined
      }
      report_employees: {
        Args: { p_area: string; p_from: string; p_to: string }
        Returns: {
          address_enc: string | null
          approved_at: string | null
          approved_by: string | null
          area: string | null
          bhw_id_number: string | null
          consent_at: string | null
          contact_number_enc: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          photo_url: string | null
          rejection_reason: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      reset_device: {
        Args: { p_employee_id: string; p_reason: string }
        Returns: undefined
      }
      resolve_punch: {
        Args: { p_at: string; p_employee_id: string }
        Returns: Record<string, unknown>
      }
      review_correction_request: {
        Args: {
          p_decision: Database["public"]["Enums"]["correction_status"]
          p_remarks?: string
          p_request_id: string
        }
        Returns: undefined
      }
      rotate_profile_encryption_key: {
        Args: { p_new_secret_name: string }
        Returns: number
      }
      run_end_of_day: { Args: { p_work_date?: string }; Returns: Json }
      run_periodic_verification: { Args: never; Returns: Json }
      run_retention: { Args: never; Returns: Json }
      schedule_for: {
        Args: { p_date: string; p_employee_id: string }
        Returns: {
          break_end: string
          break_start: string
          created_at: string
          created_by: string | null
          end_time: string
          grace_minutes: number
          id: string
          name: string
          start_time: string
          updated_at: string
          work_days: number[]
        }
        SetofOptions: {
          from: "*"
          to: "schedules"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      scheduled_work_days: {
        Args: { p_employee_id: string; p_from: string; p_to: string }
        Returns: number
      }
      set_audit_context: {
        Args: { p_action: string; p_actor?: string }
        Returns: undefined
      }
      set_my_photo: { Args: { p_path: string }; Returns: undefined }
      settings: {
        Args: never
        Returns: {
          cooldown_minutes: number
          correction_window_days: number
          dtr_fill_break_times: boolean
          geofence_radius_m: number
          heartbeat_interval_seconds: number
          id: number
          max_gps_accuracy_m: number
          office_address: string
          office_name: string
          overnight_cutoff_hour: number
          selfie_required: boolean
          selfie_retention_days: number
          token_lifetime_seconds: number
          token_refresh_seconds: number
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "app_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      storage_purge_candidates: {
        Args: never
        Returns: {
          bucket_id: string
          name: string
        }[]
      }
      update_my_contact: {
        Args: {
          p_address: string
          p_contact_number: string
          p_photo_url?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      attendance_method: "qr" | "fallback_personal_qr" | "manual" | "correction"
      attendance_status:
        | "on_time"
        | "late"
        | "absent"
        | "undertime"
        | "incomplete"
      correction_status: "pending" | "approved" | "rejected" | "cancelled"
      correction_type:
        | "missing_time_in"
        | "missing_time_out"
        | "wrong_time"
        | "official_business"
      device_platform: "android" | "ios"
      error_severity: "info" | "warning" | "error" | "critical"
      error_source: "edge_function" | "kiosk" | "mobile" | "web"
      notification_kind:
        | "registration_approved"
        | "registration_rejected"
        | "correction_approved"
        | "correction_rejected"
        | "device_reset"
        | "record_incomplete"
        | "new_registration"
        | "new_correction_request"
        | "kiosk_offline"
        | "periodic_verification"
      profile_status: "pending" | "active" | "rejected" | "inactive"
      user_role: "admin" | "employee" | "kiosk" | "viewer"
    }
    CompositeTypes: {
      dtr_row: {
        day: number | null
        work_date: string | null
        am_arrival: string | null
        am_departure: string | null
        pm_arrival: string | null
        pm_departure: string | null
        undertime_hours: number | null
        undertime_minutes: number | null
        remark: string | null
        status: Database["public"]["Enums"]["attendance_status"] | null
        method: Database["public"]["Enums"]["attendance_method"] | null
      }
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
      attendance_method: ["qr", "fallback_personal_qr", "manual", "correction"],
      attendance_status: [
        "on_time",
        "late",
        "absent",
        "undertime",
        "incomplete",
      ],
      correction_status: ["pending", "approved", "rejected", "cancelled"],
      correction_type: [
        "missing_time_in",
        "missing_time_out",
        "wrong_time",
        "official_business",
      ],
      device_platform: ["android", "ios"],
      error_severity: ["info", "warning", "error", "critical"],
      error_source: ["edge_function", "kiosk", "mobile", "web"],
      notification_kind: [
        "registration_approved",
        "registration_rejected",
        "correction_approved",
        "correction_rejected",
        "device_reset",
        "record_incomplete",
        "new_registration",
        "new_correction_request",
        "kiosk_offline",
        "periodic_verification",
      ],
      profile_status: ["pending", "active", "rejected", "inactive"],
      user_role: ["admin", "employee", "kiosk", "viewer"],
    },
  },
} as const
