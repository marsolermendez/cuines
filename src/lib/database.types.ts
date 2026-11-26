
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
            "entries": {
                  Row: {
                    "author_id": string,"body": string,"cooked_on": string | null,"created_at": string,"id": string,"planned_for": string | null,"position": number | null,"published_at": string | null,"recipe_id": string,"status": string,"tags": (string)[],"title": string | null,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body"?: string,"cooked_on"?: string | null,"created_at"?: string,"id"?: string,"planned_for"?: string | null,"position"?: number | null,"published_at"?: string | null,"recipe_id": string,"status": string,"tags"?: (string)[],"title"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"cooked_on"?: string | null,"created_at"?: string,"id"?: string,"planned_for"?: string | null,"position"?: number | null,"published_at"?: string | null,"recipe_id"?: string,"status"?: string,"tags"?: (string)[],"title"?: string | null,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entries_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"entry_photos": {
                  Row: {
                    "entry_id": string,"height": number,"id": string,"path": string,"placeholder": string,"position": number,"thumb_path": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "entry_id": string,"height": number,"id"?: string,"path": string,"placeholder": string,"position": number,"thumb_path": string,"width": number
                  }
                  Update: {
                    "entry_id"?: string,"height"?: number,"id"?: string,"path"?: string,"placeholder"?: string,"position"?: number,"thumb_path"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "entry_photos_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"bio": string,"created_at": string,"display_name": string,"id": string,"is_private": boolean,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"bio"?: string,"created_at"?: string,"display_name"?: string,"id": string,"is_private"?: boolean,"username"?: string | null
                  }
                  Update: {
                    "avatar_url"?: string | null,"bio"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"is_private"?: boolean,"username"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"recipes": {
                  Row: {
                    "created_at": string,"id": string,"ingredients": (string)[],"owner_id": string,"source_url": string | null,"steps": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"ingredients"?: (string)[],"owner_id": string,"source_url"?: string | null,"steps"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"ingredients"?: (string)[],"owner_id"?: string,"source_url"?: string | null,"steps"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_read_entry":
{ Args: { "eauthor": string,"eid": string,"estatus": string,"evisibility": string }; Returns: boolean
                           },
"is_follower":
{ Args: { "uid": string }; Returns: boolean
                           },
"is_participant":
{ Args: { "eid": string }; Returns: boolean
                           },
"is_private":
{ Args: { "uid": string }; Returns: boolean
                           },
"recipe_has_readable_entry":
{ Args: { "rid": string }; Returns: boolean
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
            
          }
        }
} as const
