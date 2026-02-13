export interface RecordRow {
  id: number;
  user_id: number;
  domain: string;
  record_type: string;
  slug: string;
  title: string;
  content: string;
  structured_data: string | null;
  source: string;
  source_detail: string | null;
  priority: number;
  status: string;
  pinned: number;
  record_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordVersionRow {
  id: number;
  record_id: number;
  content: string;
  structured_data: string | null;
  created_at: string;
}

export interface TagRow {
  id: number;
  user_id: number;
  name: string;
  color: string | null;
}

export interface AgentRow {
  id: number;
  user_id: number;
  name: string;
  description: string;
  tagline: string;
  system_prompt: string;
  avatar: string;
  created_at: string;
}
