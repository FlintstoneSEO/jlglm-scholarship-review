import { supabase } from "@/integrations/supabase/client";
import { saveReviewerAssignment, type AssignmentInput } from "./testing-workflow";
/** Both assignment entry points retain the same table, constraints and RLS. */
export function assignReviewer(input: AssignmentInput) {
  return saveReviewerAssignment(input, (row) => supabase.from("reviewer_assignments").insert(row));
}
