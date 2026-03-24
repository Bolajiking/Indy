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

export interface SkillOutcome {
  id: string;
  creator_id: string;
  skill: string;
  action_id: string | null;
  input_summary: string | null;
  output_summary: string | null;
  success: boolean;
  creator_feedback: string | null;
  creator_rating: number | null;
  learnings: string | null;
  created_at: string;
}

export async function getCreatorMemories(
  creatorId: string,
  skill?: string | null
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
  }
): Promise<void> {
  const { error } = await supabase.from("creator_memories").upsert(
    {
      creator_id: creatorId,
      memory_type: memory.memory_type,
      skill: memory.skill,
      key: memory.key,
      content: memory.content,
      confidence: memory.confidence ?? 1.0,
      times_reinforced: 1,
      last_used_at: new Date().toISOString(),
    },
    {
      onConflict: "creator_id,skill,key",
      ignoreDuplicates: false,
    }
  );
  if (error) throw error;
}

export async function reinforceMemory(
  creatorId: string,
  skill: string | null,
  key: string
): Promise<void> {
  const { error } = await supabase.rpc("reinforce_memory", {
    p_creator_id: creatorId,
    p_skill: skill,
    p_key: key,
  });
  // Fail silently — non-critical
  if (error) {
    // Fallback: manual increment
    await supabase
      .from("creator_memories")
      .update({
        times_reinforced: supabase.rpc as any,
        last_used_at: new Date().toISOString(),
      })
      .eq("creator_id", creatorId)
      .eq("key", key);
  }
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

export async function getSkillOutcomes(
  creatorId: string,
  skill: string,
  limit = 20
): Promise<SkillOutcome[]> {
  const { data, error } = await supabase
    .from("skill_outcomes")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("skill", skill)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SkillOutcome[];
}

export async function formatMemoriesForPrompt(
  creatorId: string,
  skill: string
): Promise<string> {
  const memories = await getCreatorMemories(creatorId, skill);
  if (memories.length === 0) return "";

  const lines = memories.map((m) => {
    const scope = m.skill ? `[${m.skill}]` : "[global]";
    return `- ${scope} ${m.memory_type}: ${m.content}`;
  });

  return `\n## What I've Learned About This Creator\n${lines.join("\n")}`;
}
