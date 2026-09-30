import { supabase } from "@/integrations/supabase/client";

// Fail closed: a missing/inaccessible profile is never treated as completed setup.
export async function readAccountSetupCompleted(userId: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_setup_completed")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.account_setup_completed ?? null;
}

export async function completeAccountSetup(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ account_setup_completed: true })
    .eq("id", userId)
    .select("account_setup_completed")
    .single();
  if (error || data?.account_setup_completed !== true)
    throw error ?? new Error("Account setup could not be confirmed.");
}
