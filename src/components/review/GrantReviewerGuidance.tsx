const fundingTiers = [
  [
    "90–100",
    "Exceptional",
    "Strong recommendation for funding",
    "Application demonstrates a compelling business opportunity, strong use of funds, measurable impact, and high likelihood that the grant will contribute to meaningful growth.",
  ],
  [
    "80–89",
    "Very Strong",
    "Recommend for funding",
    "Strong application with a credible growth plan and appropriate use of funds. Minor weaknesses do not materially affect the likelihood of success.",
  ],
  [
    "70–79",
    "Competitive",
    "Consider for funding",
    "Application demonstrates potential but has identifiable weaknesses in the growth strategy, financial position, use of funds, or measurable outcomes.",
  ],
  [
    "60–69",
    "Marginal",
    "Consider only if funding remains available",
    "Some elements are promising, but the application does not yet demonstrate a sufficiently strong connection between the grant investment and measurable growth.",
  ],
  [
    "Below 60",
    "Weak",
    "Do not recommend for funding",
    "Application does not adequately demonstrate business readiness, a viable growth opportunity, appropriate use of funds, or measurable impact.",
  ],
] as const;

const redFlags = [
  "The use of funds is vague.",
  "Grant funds are primarily intended to cover recurring expenses with no clear growth outcome.",
  "The applicant cannot explain significant financial changes shown in the P&L.",
  "Proposed expenses do not match the stated growth opportunity.",
  "Expected outcomes are entirely subjective or unmeasurable.",
  "The applicant proposes more growth than the $11,250 investment could reasonably support.",
  "The application contains inconsistent information.",
  "The business is not in good standing with LARA.",
  "Required documentation is missing.",
];

export function GrantReviewerGuidance() {
  return (
    <div className="space-y-3 text-sm">
      <details className="rounded-lg border border-border px-4 py-3">
        <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Reviewer Guide · questions and red flags
        </summary>
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <strong>Is this a viable business?</strong> Does the financial information, customer
              base, business narrative, and operating history demonstrate a legitimate business with
              potential for continued operation and growth?
            </li>
            <li>
              <strong>Is there a real growth opportunity?</strong> Is the applicant proposing
              something that will expand or strengthen the business, rather than simply cover
              routine expenses?
            </li>
            <li>
              <strong>Will $11,250 make a meaningful difference?</strong> Is there a clear
              connection between the proposed expenditure and the expected business outcome?
            </li>
            <li>
              <strong>Can the applicant execute the plan?</strong> Does the business have the
              operational and financial capacity to put the funds to productive use?
            </li>
          </ol>
          <h3 className="font-semibold">Red flags to examine</h3>
          <p className="text-muted-foreground">
            Consider requesting clarification or a lower criterion score when a red flag applies.
          </p>
          <ul className="list-disc columns-1 space-y-1 pl-5 sm:columns-2">
            {redFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            A red flag does not automatically mean denial unless it violates a stated eligibility
            requirement.
          </p>
        </div>
      </details>
      <details className="rounded-lg border border-border px-4 py-3">
        <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Funding guidance
        </summary>
        <p className="mt-3 text-muted-foreground">
          Score is one component of the final funding decision.
        </p>
        <dl className="mt-2 divide-y divide-border">
          {fundingTiers.map(([score, tier, guidance, explanation]) => (
            <div key={score} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
              <dt className="font-semibold">
                {score} · {tier}
              </dt>
              <dd>
                {guidance}
                <span className="mt-1 block text-muted-foreground">{explanation}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-muted-foreground">
          Recommendation options in the source rubric: Strongly Recommend, Recommend, Consider, Do
          Not Recommend. This portal does not currently persist a structured Grant recommendation.
        </p>
      </details>
    </div>
  );
}

export function GrantConsistencyGuidance() {
  return (
    <details className="rounded-lg border border-border px-4 py-3 text-sm">
      <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Before submitting · consistency and conflict of interest
      </summary>
      <p className="mt-2 text-muted-foreground">
        Review these confirmations before final submission. This guide does not record a
        certification.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5">
        <li>I reviewed the application using the same criteria applied to other applicants.</li>
        <li>I did not score based on personal familiarity with or opinions about the applicant.</li>
        <li>I considered the applicant's business stage and circumstances.</li>
        <li>
          I evaluated the proposed use of funds rather than simply the applicant's financial need.
        </li>
        <li>
          My score reflects the information contained in the application and supporting documents.
        </li>
        <li>I disclosed any potential conflict of interest according to program policy.</li>
      </ul>
    </details>
  );
}
