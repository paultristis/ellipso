import { createClient } from "@/lib/supabase/server";

export async function getOrCreateWorkspaceForUser(userId: string) {
  const supabase = await createClient();

  let { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  
  if (!profile) {
    const created = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
      })
      .select("*")
      .single();

    if (created.error) throw created.error;
    profile = created.data;
  }

  let { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("*")
    .eq("owner_profile_id", profile.id)
    .maybeSingle();

  if (workspaceError) throw workspaceError; 
  
  if (!workspace) {
    const created = await supabase
      .from("workspaces")
      .insert({
        owner_profile_id: profile.id,
        title: "Untitled",
      })
      .select("*")
      .single();

    if (created.error) throw created.error;
    workspace = created.data;
  }

  return { profile, workspace };
}