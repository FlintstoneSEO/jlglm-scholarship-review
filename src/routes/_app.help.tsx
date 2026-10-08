import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { helpGuideKind } from "@/lib/help-guide";
import { ScholarshipHelpGuide } from "@/components/help/ScholarshipHelpGuide";
import { BusinessGrowthGrantHelpGuide } from "@/components/help/BusinessGrowthGrantHelpGuide";

export const Route = createFileRoute("/_app/help")({
  head: () => ({
    meta: [
      { title: "Help & Guide — Justice League Review Portal" },
      {
        name: "description",
        content: "How to use the Justice League of Greater Lansing review portal.",
      },
    ],
  }),
  component: HelpPage,
});

function HelpPage() {
  const { selectedProgram } = useAuth();
  const guide = helpGuideKind(selectedProgram?.slug ?? null);
  if (guide === "choose_program" || !selectedProgram) {
    return <Card className="p-6">Choose a review program to see its help guide.</Card>;
  }
  return guide === "business_growth_grant" ? (
    <BusinessGrowthGrantHelpGuide programName={selectedProgram.name} />
  ) : (
    <ScholarshipHelpGuide programName={selectedProgram.name} />
  );
}
