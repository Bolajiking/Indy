import { supabase } from "../client.js";

export interface CreatorMemory {
  id: string;
  creator_id: string;
  memory_type: "preference" | "pattern" | "outcome" | "context" | "learned";
  skill: string | null;
  key: string;
  content: string;
  confidence: number;
  times_reinforced: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export async function getCreatorMemories(
  creatorId: string,
  skill?: string | null,
): Promise<CreatorMemory[]> {
  let query = supabase
    .from("creator_memories")
    .select("*")
    .eq("creator_id", creatorId)
    .order("times_reinforced", { ascending: false })
    .limit(50);

  if (skill !== undefined) {
    if (skill === null) {
      query = query.is("skill", null);
    } else {
      query = query.or(`skill.eq.${skill},skill.is.null`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CreatorMemory[];
}

export async function upsertCreatorMemory(
  creatorId: string,
  memory: {
    memory_type: CreatorMemory["memory_type"];
    skill: string | null;
    key: string;
    content: string;
    confidence?: number;
  },
): Promise<void> {
  const now = new Date().toISOString();

  // Global memories (skill = null) can't use ON CONFLICT: Postgres treats NULLs
  // as distinct in unique indexes, so it would insert duplicates instead of
  // updating. Dedupe manually on (creator_id, key) where skill IS NULL.
  if (memory.skill === null) {
    const { data: existing } = await supabase
      .from("creator_memories")
      .select("id")
      .eq("creator_id", creatorId)
      .is("skill", null)
      .eq("key", memory.key)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("creator_memories")
        .update({
          memory_type: memory.memory_type,
          content: memory.content,
          confidence: memory.confidence ?? 1.0,
          last_used_at: now,
        })
        .eq("id", existing.id);
      if (error) throw error;
      return;
    }

    const { error } = await supabase.from("creator_memories").insert({
      creator_id: creatorId,
      memory_type: memory.memory_type,
      skill: null,
      key: memory.key,
      content: memory.content,
      confidence: memory.confidence ?? 1.0,
      times_reinforced: 1,
      last_used_at: now,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("creator_memories").upsert(
    {
      creator_id: creatorId,
      memory_type: memory.memory_type,
      skill: memory.skill,
      key: memory.key,
      content: memory.content,
      confidence: memory.confidence ?? 1.0,
      times_reinforced: 1,
      last_used_at: now,
    },
    {
      onConflict: "creator_id,skill,key",
      ignoreDuplicates: false,
    },
  );
  if (error) throw error;
}

export async function recordSkillOutcome(outcome: {
  creator_id: string;
  skill: string;
  action_id?: string;
  input_summary?: string;
  output_summary?: string;
  success: boolean;
  creator_feedback?: string;
  creator_rating?: number;
  learnings?: string;
}): Promise<void> {
  const { error } = await supabase.from("skill_outcomes").insert(outcome);
  if (error) throw error;
}

export async function formatMemoriesForPrompt(
  creatorId: string,
  skill: string,
): Promise<string> {
  const memories = await getCreatorMemories(creatorId, skill);
  if (memories.length === 0) return "";

  const lines = memories.map((m) => {
    const scope = m.skill ? `[${m.skill}]` : "[global]";
    return `- ${scope} ${m.memory_type}: ${m.content}`;
  });

  return `\n## What I've Learned About This Creator\n${lines.join("\n")}`;
}
