
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "challenge_attempts": {
                  Row: {
                    "challenge_id": string,"created_at": string,"id": string,"marked_solved": boolean,"notes": string | null,"solution": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"id"?: string,"marked_solved"?: boolean,"notes"?: string | null,"solution": string,"user_id": string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"id"?: string,"marked_solved"?: boolean,"notes"?: string | null,"solution"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenge_attempts_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"challenges": {
                  Row: {
                    "created_at": string,"evaluation_criteria": (string)[],"hints": (string)[],"id": string,"instructions_md": string | null,"is_additional": boolean,"is_required": boolean,"key": string,"level": number,"objective": string,"position": number,"reference_solution_md": string | null,"required_knowledge": (string)[],"slug": string,"statement_md": string,"title": string,"topic_id": string,"type": Database["public"]['Enums']["challenge_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"evaluation_criteria"?: (string)[],"hints"?: (string)[],"id"?: string,"instructions_md"?: string | null,"is_additional"?: boolean,"is_required"?: boolean,"key": string,"level": number,"objective": string,"position": number,"reference_solution_md"?: string | null,"required_knowledge"?: (string)[],"slug": string,"statement_md": string,"title": string,"topic_id": string,"type": Database["public"]['Enums']["challenge_type"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"evaluation_criteria"?: (string)[],"hints"?: (string)[],"id"?: string,"instructions_md"?: string | null,"is_additional"?: boolean,"is_required"?: boolean,"key"?: string,"level"?: number,"objective"?: string,"position"?: number,"reference_solution_md"?: string | null,"required_knowledge"?: (string)[],"slug"?: string,"statement_md"?: string,"title"?: string,"topic_id"?: string,"type"?: Database["public"]['Enums']["challenge_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenges_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"learning_contents": {
                  Row: {
                    "body_md": string,"created_at": string,"id": string,"is_additional": boolean,"key": string,"kind": Database["public"]['Enums']["content_kind"],"position": number,"title": string,"topic_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_md": string,"created_at"?: string,"id"?: string,"is_additional"?: boolean,"key": string,"kind"?: Database["public"]['Enums']["content_kind"],"position": number,"title": string,"topic_id": string,"updated_at"?: string
                  }
                  Update: {
                    "body_md"?: string,"created_at"?: string,"id"?: string,"is_additional"?: boolean,"key"?: string,"kind"?: Database["public"]['Enums']["content_kind"],"position"?: number,"title"?: string,"topic_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "learning_contents_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"modules": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"key": string,"objectives": (string)[],"position": number,"slug": string,"stage_id": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"key": string,"objectives"?: (string)[],"position": number,"slug": string,"stage_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"key"?: string,"objectives"?: (string)[],"position"?: number,"slug"?: string,"stage_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modules_stage_id_fkey"
      columns: ["stage_id"]
isOneToOne: false
      referencedRelation: "stages"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"email": string | null,"id": string,"last_topic_at": string | null,"last_topic_id": string | null,"settings": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id": string,"last_topic_at"?: string | null,"last_topic_id"?: string | null,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"last_topic_at"?: string | null,"last_topic_id"?: string | null,"settings"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_last_topic_id_fkey"
      columns: ["last_topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"stages": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"key": string,"position": number,"slug": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"id"?: string,"key": string,"position": number,"slug": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"key"?: string,"position"?: number,"slug"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"study_sessions": {
                  Row: {
                    "created_at": string,"duration_seconds": number,"ended_at": string | null,"id": string,"source": Database["public"]['Enums']["session_source"],"started_at": string,"topic_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_seconds"?: number,"ended_at"?: string | null,"id"?: string,"source"?: Database["public"]['Enums']["session_source"],"started_at"?: string,"topic_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"duration_seconds"?: number,"ended_at"?: string | null,"id"?: string,"source"?: Database["public"]['Enums']["session_source"],"started_at"?: string,"topic_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "study_sessions_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"topic_prerequisites": {
                  Row: {
                    "kind": Database["public"]['Enums']["prerequisite_kind"],"prerequisite_id": string,"reason": string | null,"topic_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "kind"?: Database["public"]['Enums']["prerequisite_kind"],"prerequisite_id": string,"reason"?: string | null,"topic_id": string
                  }
                  Update: {
                    "kind"?: Database["public"]['Enums']["prerequisite_kind"],"prerequisite_id"?: string,"reason"?: string | null,"topic_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "topic_prerequisites_prerequisite_id_fkey"
      columns: ["prerequisite_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "topic_prerequisites_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"topics": {
                  Row: {
                    "completion_criteria": NonNullable<Json>,"content_status": Database["public"]['Enums']["content_status"],"created_at": string,"estimated_minutes": number | null,"id": string,"is_additional": boolean,"key": string,"module_id": string,"objectives": (string)[],"planned_challenges": NonNullable<Json>,"position": number,"slug": string,"summary": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completion_criteria"?: NonNullable<Json>,"content_status"?: Database["public"]['Enums']["content_status"],"created_at"?: string,"estimated_minutes"?: number | null,"id"?: string,"is_additional"?: boolean,"key": string,"module_id": string,"objectives"?: (string)[],"planned_challenges"?: NonNullable<Json>,"position": number,"slug": string,"summary"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "completion_criteria"?: NonNullable<Json>,"content_status"?: Database["public"]['Enums']["content_status"],"created_at"?: string,"estimated_minutes"?: number | null,"id"?: string,"is_additional"?: boolean,"key"?: string,"module_id"?: string,"objectives"?: (string)[],"planned_challenges"?: NonNullable<Json>,"position"?: number,"slug"?: string,"summary"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "topics_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    }
                  ]
                },"user_challenge_progress": {
                  Row: {
                    "challenge_id": string,"created_at": string,"hints_revealed": number,"notes": string | null,"solution": string | null,"solution_revealed_at": string | null,"solved_at": string | null,"status": Database["public"]['Enums']["challenge_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_id": string,"created_at"?: string,"hints_revealed"?: number,"notes"?: string | null,"solution"?: string | null,"solution_revealed_at"?: string | null,"solved_at"?: string | null,"status"?: Database["public"]['Enums']["challenge_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "challenge_id"?: string,"created_at"?: string,"hints_revealed"?: number,"notes"?: string | null,"solution"?: string | null,"solution_revealed_at"?: string | null,"solved_at"?: string | null,"status"?: Database["public"]['Enums']["challenge_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_challenge_progress_challenge_id_fkey"
      columns: ["challenge_id"]
isOneToOne: false
      referencedRelation: "challenges"
      referencedColumns: ["id"]
    }
                  ]
                },"user_notes": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"topic_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"topic_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"topic_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_notes_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                },"user_topic_progress": {
                  Row: {
                    "checklist_done": (string)[],"completed_at": string | null,"content_read_at": string | null,"last_accessed_at": string,"review_count": number,"reviewed_at": string | null,"self_assessment": number | null,"started_at": string,"status": Database["public"]['Enums']["topic_status"],"topic_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checklist_done"?: (string)[],"completed_at"?: string | null,"content_read_at"?: string | null,"last_accessed_at"?: string,"review_count"?: number,"reviewed_at"?: string | null,"self_assessment"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["topic_status"],"topic_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "checklist_done"?: (string)[],"completed_at"?: string | null,"content_read_at"?: string | null,"last_accessed_at"?: string,"review_count"?: number,"reviewed_at"?: string | null,"self_assessment"?: number | null,"started_at"?: string,"status"?: Database["public"]['Enums']["topic_status"],"topic_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_topic_progress_topic_id_fkey"
      columns: ["topic_id"]
isOneToOne: false
      referencedRelation: "topics"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "user_activity": {
                  Row: {
                    "challenge_id": string | null,"kind": string | null,"occurred_at": string | null,"topic_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "challenge_status": "not_started"|"attempting"|"solved"|"skipped","challenge_type": "conceptual"|"interview"|"coding"|"code_analysis"|"bug_hunt"|"experiment"|"implementation"|"project","content_kind": "section"|"example"|"diagram","content_status": "planned"|"draft"|"ready","prerequisite_kind": "required"|"recommended","session_source": "auto"|"manual","topic_status": "not_started"|"in_progress"|"completed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "challenge_status": ["not_started", "attempting", "solved", "skipped"],"challenge_type": ["conceptual", "interview", "coding", "code_analysis", "bug_hunt", "experiment", "implementation", "project"],"content_kind": ["section", "example", "diagram"],"content_status": ["planned", "draft", "ready"],"prerequisite_kind": ["required", "recommended"],"session_source": ["auto", "manual"],"topic_status": ["not_started", "in_progress", "completed"]
          }
        }
} as const
