import { cookies } from 'next/headers'
import { redirect } from "next/navigation";
import ModelspacePage from "@/components/modelspace/ModelspacePage";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspaceForUser } from "@/lib/modelspace/workspace-service";
import { getOriginalCodeFrame } from 'next/dist/next-devtools/server/shared';

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = await createClient();

  const { 
    data: {user},
    error,
    } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { profile, workspace } = await getOrCreateWorkspaceForUser(user.id);
  
  return (
    <ModelspacePage 
      profileId={profile.id}
      workspaceId={workspace.id}
    />
  );
}
