import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function useGrantSelection(programId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["grant-selection", programId],
    enabled: enabled && !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grant_selection_decisions")
        .select("*")
        .eq("program_id", programId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
