// Source: committee-approved Evaluation Rubric.docx. Match by name and maximum so
// historical or future rubric versions do not inherit guidance for different criteria.
export type ScoreBand = { range: string; rating: string; guidance: readonly string[] };
export type CriterionGuidance = {
  name: string;
  maximum: number;
  description: string;
  bands: readonly ScoreBand[];
  note?: string;
};

export const grantRubricGuidance: readonly CriterionGuidance[] = [
  {
    name: "Business Narrative & Value Proposition",
    maximum: 15,
    description:
      "Evaluate what the business does, its customers and market, the need it addresses, its differentiation, current position, and realistic growth opportunity.",
    bands: [
      {
        range: "13–15",
        rating: "Excellent",
        guidance: [
          "Clearly explains what the business does",
          "Clearly identifies customers/market",
          "Demonstrates a compelling customer need or market opportunity",
          "Clearly articulates the business's competitive advantage/value proposition",
          "Demonstrates a realistic understanding of the business's current position and growth opportunity",
        ],
      },
      {
        range: "10–12",
        rating: "Strong",
        guidance: [
          "Clearly explains the business and customers",
          "Identifies a reasonable need or opportunity",
          "Provides some differentiation",
          "Growth opportunity is apparent but could be more specific",
        ],
      },
      {
        range: "7–9",
        rating: "Adequate",
        guidance: [
          "Provides a basic description of the business",
          "Customer/market is somewhat clear",
          "Limited explanation of differentiation or growth opportunity",
        ],
      },
      {
        range: "1–6",
        rating: "Weak",
        guidance: [
          "Vague or incomplete business description",
          "Limited understanding of customers or market",
          "Little evidence of differentiation",
          "Growth opportunity is unclear",
        ],
      },
      {
        range: "0",
        rating: "No meaningful response",
        guidance: ["No meaningful response or response is unrelated to the question"],
      },
    ],
  },
  {
    name: "Financial Performance & Business Health",
    maximum: 15,
    description:
      "Review the 2024 and 2025 P&L statements and explanation of changes. Evaluate revenue, profitability, expenses, trends, record quality, and financial understanding.",
    bands: [
      {
        range: "13–15",
        rating: "Excellent",
        guidance: [
          "Complete and credible financial statements",
          "Demonstrates a clear understanding of financial performance",
          "Financial trends support a viable business",
          "Applicant appropriately explains major changes in revenue, expenses, or profitability",
          "Demonstrates sound financial management",
        ],
      },
      {
        range: "10–12",
        rating: "Strong",
        guidance: [
          "Financial statements are complete",
          "Business demonstrates reasonable financial health",
          "Applicant understands major financial trends",
          "Some areas require clarification but do not create significant concerns",
        ],
      },
      {
        range: "7–9",
        rating: "Adequate",
        guidance: [
          "Statements are provided but reveal limited financial strength or inconsistent performance",
          "Applicant provides a basic explanation of financial trends",
          "Financial management practices are developing",
        ],
      },
      {
        range: "1–6",
        rating: "Weak",
        guidance: [
          "Significant financial concerns",
          "Statements are incomplete or difficult to interpret",
          "Applicant cannot adequately explain financial performance",
          "Limited evidence of financial management",
        ],
      },
      {
        range: "0",
        rating: "Required information absent",
        guidance: ["Required financial information is not provided"],
      },
    ],
    note: "A business does not need to be highly profitable to score well. Reviewers should consider the applicant's stage of business, demonstrated trajectory, and whether the grant could reasonably improve its financial position.",
  },
  {
    name: "Growth Opportunity",
    maximum: 15,
    description:
      "Evaluate whether the $11,250 grant enables a specific, realistic, meaningful growth opportunity connected to the business's current position and justified now.",
    bands: [
      {
        range: "13–15",
        rating: "Excellent",
        guidance: [
          "Clearly identifies a significant growth opportunity",
          "Demonstrates why the opportunity matters now",
          "Provides a compelling connection between the business's current position and proposed growth",
          "Opportunity is realistic and achievable",
          "Grant funding is an appropriate tool to address the opportunity",
        ],
      },
      {
        range: "10–12",
        rating: "Strong",
        guidance: [
          "Identifies a clear growth opportunity",
          "Provides reasonable justification",
          "Connection to the grant is apparent",
          "Opportunity is achievable",
        ],
      },
      {
        range: "7–9",
        rating: "Adequate",
        guidance: [
          "Growth opportunity is identified but somewhat broad",
          "Limited evidence of urgency or strategic importance",
          "Connection to grant funding is reasonable but not compelling",
        ],
      },
      {
        range: "1–6",
        rating: "Weak",
        guidance: [
          "Growth opportunity is vague",
          "Funding appears primarily focused on maintaining current operations rather than growth",
          "Limited explanation of why funding is needed",
        ],
      },
      { range: "0", rating: "No opportunity", guidance: ["No identifiable growth opportunity"] },
    ],
  },
  {
    name: "Use of Grant Funds",
    maximum: 20,
    description:
      "Evaluate whether the $11,250 spending plan is specific, reasonable, necessary, eligible, appropriately budgeted, and directly connected to growth.",
    bands: [
      {
        range: "17–20",
        rating: "Excellent",
        guidance: [
          "Provides a detailed and credible spending plan",
          "Clearly identifies major expenditures and estimated costs",
          "Each expense has a clear business purpose",
          "Strong connection between expenditures and growth",
          "Budget is reasonable and appropriately scaled to $11,250",
          "Applicant demonstrates thoughtful use of limited grant resources",
        ],
      },
      {
        range: "13–16",
        rating: "Strong",
        guidance: [
          "Provides a clear spending plan",
          "Most expenses are specific and justified",
          "Strong connection to business needs",
          "Costs appear reasonable",
        ],
      },
      {
        range: "9–12",
        rating: "Adequate",
        guidance: [
          "Provides a general spending plan",
          "Some expenses lack detail or justification",
          "Connection to growth is present but could be stronger",
          "Budget may require clarification",
        ],
      },
      {
        range: "1–8",
        rating: "Weak",
        guidance: [
          "Spending plan is vague",
          "Costs are unclear or unsupported",
          "Expenses appear primarily operational without a clear growth connection",
          "Limited justification for how funds will be used",
        ],
      },
      { range: "0", rating: "No plan", guidance: ["No meaningful use-of-funds plan"] },
    ],
  },
  {
    name: "Expected Business Impact & Measurable Outcomes",
    maximum: 15,
    description:
      "Evaluate specific, measurable, realistic results within 12 months, with a clear causal link to the grant and metrics or targets.",
    bands: [
      {
        range: "13–15",
        rating: "Excellent",
        guidance: [
          "Identifies 1–3 specific, measurable outcomes",
          "Outcomes are realistic and meaningful",
          "Strong causal connection between grant investment and expected results",
          "Provides clear metrics or targets",
          "Impact can reasonably be evaluated within 12 months",
        ],
      },
      {
        range: "10–12",
        rating: "Strong",
        guidance: [
          "Identifies meaningful outcomes",
          "Outcomes are reasonably measurable",
          "Connection to grant investment is clear",
          "Some metrics may need additional specificity",
        ],
      },
      {
        range: "7–9",
        rating: "Adequate",
        guidance: [
          "Identifies expected benefits",
          "Outcomes are somewhat measurable",
          "Connection between funding and outcomes is reasonable but not fully developed",
        ],
      },
      {
        range: "1–6",
        rating: "Weak",
        guidance: [
          "Outcomes are vague",
          'Primarily uses general statements such as "grow the business" or "increase visibility"',
          "Little evidence of how success will be measured",
        ],
      },
      { range: "0", rating: "No impact", guidance: ["No identifiable expected impact"] },
    ],
  },
  {
    name: "Business Capacity & Financial Management",
    maximum: 10,
    description:
      "Evaluate owner involvement, financial tracking and accounting, customer demand, and ability to execute the proposed project.",
    bands: [
      {
        range: "9–10",
        rating: "Excellent",
        guidance: [
          "Demonstrates strong operational capacity",
          "Uses appropriate financial tracking systems",
          "Owner has meaningful involvement in the business",
          "Has demonstrated customer demand",
          "Has the capacity to execute the proposed growth plan",
        ],
      },
      {
        range: "7–8",
        rating: "Strong",
        guidance: [
          "Demonstrates adequate operational capacity",
          "Basic financial management systems are in place",
          "Evidence of customer demand",
          "Appears capable of implementing the proposed project",
        ],
      },
      {
        range: "4–6",
        rating: "Adequate",
        guidance: [
          "Some systems and capacity are in place",
          "Business may need additional support to execute the plan",
          "Customer demand is developing",
        ],
      },
      {
        range: "1–3",
        rating: "Weak",
        guidance: [
          "Limited financial or operational systems",
          "Limited evidence of capacity to execute the proposed project",
        ],
      },
      {
        range: "0",
        rating: "Insufficient information",
        guidance: ["Insufficient information to assess capacity"],
      },
    ],
  },
  {
    name: "Why This Grant, and Why Now?",
    maximum: 10,
    description:
      "Evaluate the timing, strategic importance, growth connection, and whether the grant materially enables the proposed opportunity.",
    bands: [
      {
        range: "9–10",
        rating: "Excellent",
        guidance: [
          "Presents a compelling and timely case for funding",
          "Clearly explains why the business cannot easily achieve the proposed growth without this investment",
          "Demonstrates urgency without relying solely on financial hardship",
          "Clearly connects the grant to the business's growth strategy",
        ],
      },
      {
        range: "7–8",
        rating: "Strong",
        guidance: [
          "Provides a clear rationale for funding",
          "Explains why the investment is timely",
          "Connection to growth is apparent",
        ],
      },
      {
        range: "4–6",
        rating: "Adequate",
        guidance: ["Provides a reasonable explanation", "Somewhat generic or lacks specificity"],
      },
      {
        range: "1–3",
        rating: "Weak",
        guidance: [
          "Primarily describes a need for money without explaining the strategic purpose",
          "Limited connection to growth",
        ],
      },
      { range: "0", rating: "No response", guidance: ["No meaningful response"] },
    ],
  },
] as const;

export function guidanceForGrantCriterion(
  name: string,
  maximum: number,
): CriterionGuidance | undefined {
  return grantRubricGuidance.find(
    (criterion) => criterion.name === name && criterion.maximum === maximum,
  );
}
