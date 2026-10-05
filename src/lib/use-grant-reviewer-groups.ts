import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export function useGrantReviewerGroups(programId: string) {
  return useQuery({
    queryKey: ["grant-reviewer-groups", programId],
    queryFn: async () => {
      const groups = await supabase
        .from("grant_reviewer_groups")
        .select("*")
        .eq("program_id", programId)
        .order("name");
      if (groups.error) throw groups.error;
      if (!groups.data.length) return [];
      const members = await supabase
        .from("grant_reviewer_group_members")
        .select("*")
        .in(
          "group_id",
          groups.data.map((g) => g.id),
        );
      if (members.error) throw members.error;
      return groups.data.map((g) => ({
        ...g,
        members: members.data
          .filter((m) => m.group_id === g.id)
          .map((m) => m.user_id)
          .sort(),
      }));
    },
  });
}
