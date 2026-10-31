import type { Transaction } from 'dexie';
import type { CardType, ChecklistItem, ExtractKind, Journal, KnowledgeCard, KnowledgeExtract, Phase } from '../types';
import { DEFAULT_JOURNAL_ID, uid } from '../lib/id';

interface SeedCard {
  type: CardType;
  title: string;
  content: string;
  tags: string[];
  pinned?: boolean;
  source?: string;
}

interface SeedExtract {
  kind: ExtractKind;
  title: string;
  text: string;
  sourceDocument?: string;
  tags: string[];
}

interface SeedPhase {
  title: string;
  description: string;
  objectives: string[];
  tasks: string[];
  cards: SeedCard[];
  extracts?: SeedExtract[];
}

/** Starter DCF journal. Kept deliberately concise: a scaffold, not a textbook. */
export const SEED_PHASES: SeedPhase[] = [
  {
    title: 'Valuation Objective & Setup',
    description: 'Define why the valuation is being done, for whom, and on what basis.',
    objectives: [
      'Define the purpose and standard of value',
      'Fix the valuation date, currency and units',
      'Agree scope and information sources',
    ],
    tasks: [
      'Confirm purpose: transaction, fairness opinion, impairment or investment',
      'Define standard of value (fair market, intrinsic, investment value)',
      'Set valuation date, currency and units',
      'Identify the subject: entity, stake size, control vs minority',
      'List data sources and request outstanding information',
      'Set up model structure and version control',
    ],
    cards: [
      {
        type: 'concept',
        title: 'Standard of value',
        content:
          "Fair market value assumes a hypothetical willing buyer and seller. Investment value reflects a specific buyer's synergies. The choice decides which synergies and premiums are admissible.",
        tags: ['framework', 'scope'],
      },
      {
        type: 'decision',
        title: 'Valuation basis statement',
        content:
          'Intrinsic value of 100% of equity on a going-concern, minority basis as at [date], in [currency] millions.',
        tags: ['template'],
      },
    ],
  },
  {
    title: 'Business and Industry Understanding',
    description: 'Understand how the business makes money and what drives its economics.',
    objectives: [
      'Map the business model and revenue drivers',
      'Assess industry structure and competitive position',
      'Identify key value drivers and risks',
    ],
    tasks: [
      'Map revenue streams, customers and geographies',
      'Identify unit economics and key operating KPIs',
      'Assess industry structure (five forces)',
      'Review competitive position and moat',
      'Note key risks: regulatory, cyclical, concentration',
      'Read the annual report, investor deck and recent earnings calls',
    ],
    cards: [
      {
        type: 'important',
        title: 'Drivers before spreadsheets',
        content:
          "Every forecast line should trace back to a driver you can explain: volume, price, mix, capacity or share. If you can't name the driver, the number is a guess.",
        tags: ['forecasting', 'value-drivers'],
      },
      {
        type: 'concept',
        title: 'Moat and fade',
        content:
          'Sustained ROIC above WACC requires a competitive advantage. Without one, assume returns fade toward WACC over the forecast.',
        tags: ['roic', 'competition'],
      },
    ],
  },
  {
    title: 'Historical Financial Analysis',
    description: 'Analyse three to five years of performance to establish a reliable baseline.',
    objectives: [
      'Build clean historical statements',
      'Analyse growth, margins and returns',
      'Understand cash conversion and capital intensity',
    ],
    tasks: [
      'Spread 3–5 years of income statement, balance sheet and cash flow',
      'Reconcile to audited statements',
      'Calculate growth, margin and ROIC trends',
      'Analyse working capital days (DSO, DIO, DPO)',
      'Analyse CapEx and D&A as % of revenue',
      'Review cash conversion (FCF ÷ EBITDA)',
    ],
    cards: [
      {
        type: 'formula',
        title: 'Return on invested capital',
        content:
          'ROIC = NOPAT ÷ Invested Capital\nNOPAT = EBIT × (1 − Tax Rate)\nInvested Capital = NWC + Net PP&E + Other operating assets',
        tags: ['roic', 'returns'],
      },
      {
        type: 'formula',
        title: 'Working capital days',
        content:
          'DSO = Receivables ÷ Revenue × 365\nDIO = Inventory ÷ COGS × 365\nDPO = Payables ÷ COGS × 365',
        tags: ['working-capital'],
      },
    ],
  },
  {
    title: 'Normalisation and Adjustments',
    description: 'Strip out non-recurring and non-operating items to reveal sustainable earnings.',
    objectives: [
      'Identify one-offs and non-operating items',
      'Normalise EBITDA and EBIT',
      'Classify debt-like and cash-like items',
    ],
    tasks: [
      'Identify one-off items (restructuring, litigation, disposals)',
      'Adjust for non-operating income and assets',
      'Normalise owner and related-party compensation',
      'Treat IFRS 16 leases consistently',
      'List debt-like items (pensions, provisions, leases)',
      'Document each adjustment with its source',
    ],
    cards: [
      {
        type: 'warning',
        title: 'Consistent lease treatment',
        content:
          'If EBITDA is post-IFRS 16 (excludes rent), lease liabilities must be deducted as debt in the bridge. Mixing bases double counts or omits the cost of leases.',
        tags: ['ifrs-16', 'leases', 'bridge'],
      },
      {
        type: 'assumption',
        title: "Recurring 'one-offs'",
        content:
          'Restructuring costs appearing in three of the last five years are not one-offs. Treat a normalised average as a recurring cost.',
        tags: ['normalisation'],
      },
      {
        type: 'source',
        title: 'IFRS 16 Leases — summary',
        content:
          'Lessees recognise a right-of-use asset and a lease liability for most leases. Depreciation and interest replace the operating lease expense.',
        tags: ['ifrs-16', 'leases'],
        source: 'IFRS 16 Leases (paraphrased summary)',
      },
    ],
  },
  {
    title: 'Operating Forecast and Assumptions',
    description: 'Translate business understanding into explicit, defensible forecast drivers.',
    objectives: [
      'Forecast revenue from drivers',
      'Set margin, CapEx and working capital assumptions',
      'Keep assumptions consistent with history and industry',
    ],
    tasks: [
      'Choose the explicit forecast horizon (typically 5–10 years)',
      'Build revenue from volume × price or segment drivers',
      'Set the margin trajectory with justification',
      'Forecast CapEx, D&A and working capital',
      'Sense-check against consensus and peers',
      'Document every key assumption and its source',
    ],
    cards: [
      {
        type: 'important',
        title: 'Reinvestment must match growth',
        content:
          'High growth with low reinvestment implies an implausibly high return on new capital. Growth has to be paid for.',
        tags: ['growth', 'reinvestment'],
      },
      {
        type: 'formula',
        title: 'Fundamental growth',
        content:
          'g = Reinvestment Rate × ROIC\nReinvestment Rate = (Net CapEx + ΔNWC) ÷ NOPAT',
        tags: ['growth', 'roic'],
      },
    ],
  },
  {
    title: 'Forecast Financial Statements',
    description: 'Build integrated statements that balance and tie out every period.',
    objectives: [
      'Integrate the three statements',
      'Schedule PP&E, debt and tax',
      'Verify the balance sheet balances without plugs',
    ],
    tasks: [
      'Build the integrated income statement',
      'Build the balance sheet with supporting schedules',
      'Derive the cash flow statement',
      'Build PP&E, D&A and debt schedules',
      'Check the balance sheet balances every period',
      'Handle interest circularity deliberately',
    ],
    cards: [
      {
        type: 'warning',
        title: 'No plugs',
        content:
          'A balance sheet that only balances via a plug is not integrated. Trace any difference through the cash flow statement before moving on.',
        tags: ['modelling', 'checks'],
      },
    ],
  },
  {
    title: 'Cost of Capital (WACC)',
    description: 'Estimate the opportunity cost of capital for all providers of capital.',
    objectives: [
      'Estimate the cost of equity (CAPM)',
      'Estimate the pre-tax cost of debt',
      'Set the target capital structure',
    ],
    tasks: [
      'Set risk-free rate (government bond, matching currency)',
      'Choose the equity risk premium and document its source',
      'Derive beta from peers (unlever and relever)',
      'Estimate cost of debt from yields or credit rating',
      'Set target D/E from peers or management guidance',
      'Consider country or size premium, documented',
    ],
    cards: [
      {
        type: 'formula',
        title: 'Weighted average cost of capital',
        content: 'WACC = (E/V × Ke) + (D/V × Kd × (1 − Tax Rate))\n\nE, D = market values of equity and debt\nV = E + D',
        tags: ['wacc', 'core-formula'],
        pinned: true,
      },
      {
        type: 'formula',
        title: 'Cost of equity (CAPM)',
        content: 'Ke = Rf + β × ERP  (+ size / country premium if justified)',
        tags: ['wacc', 'capm'],
      },
      {
        type: 'formula',
        title: 'Unlevering and relevering beta',
        content: 'βU = βL ÷ [1 + (1 − t) × D/E]\nβL = βU × [1 + (1 − t) × D/E]',
        tags: ['beta', 'wacc'],
      },
      {
        type: 'important',
        title: 'Target, market-value weights',
        content:
          'Weights should reflect the long-run target capital structure at market values — not book values or the current balance sheet.',
        tags: ['wacc', 'capital-structure'],
      },
      {
        type: 'warning',
        title: 'Currency consistency',
        content:
          'Risk-free rate, ERP and cash flows must share the same currency and inflation basis. A EUR cash flow discounted at a USD WACC is a mismatch.',
        tags: ['wacc', 'consistency'],
      },
      {
        type: 'example',
        title: 'Illustrative WACC',
        content:
          'Rf 4.0%, β 1.1, ERP 5.5% → Ke = 10.05%\nKd 6.0%, tax 25% → after-tax Kd = 4.5%\nE/V 70%, D/V 30%\nWACC = 0.7 × 10.05% + 0.3 × 4.5% ≈ 8.4%',
        tags: ['wacc', 'worked-example'],
      },
    ],
  },
  {
    title: 'Free Cash Flow Construction',
    description: 'Derive unlevered free cash flow available to all providers of capital.',
    objectives: [
      'Compute FCFF for each forecast year',
      'Treat tax, CapEx and working capital consistently',
      'Apply a deliberate discounting convention',
    ],
    tasks: [
      'Compute NOPAT from EBIT',
      'Add back D&A and other non-cash items',
      'Deduct CapEx and the change in NWC',
      'Exclude interest and other financing flows',
      'Decide on mid-year convention',
      'Discount FCFF at WACC',
    ],
    cards: [
      {
        type: 'formula',
        title: 'Free cash flow to firm',
        content: 'FCFF = EBIT × (1 − Tax Rate) + D&A − CapEx − Change in NWC',
        tags: ['fcff', 'core-formula'],
        pinned: true,
      },
      {
        type: 'concept',
        title: 'FCFF vs FCFE',
        content:
          'FCFF is before financing and is discounted at WACC to give enterprise value. FCFE is after debt flows and is discounted at the cost of equity to give equity value directly.',
        tags: ['fcff', 'fcfe'],
      },
      {
        type: 'warning',
        title: "Don't deduct interest",
        content:
          'The cost of debt is already captured in WACC through Kd. Deducting interest from FCFF counts it twice.',
        tags: ['fcff', 'consistency'],
      },
      {
        type: 'formula',
        title: 'Mid-year discount factor',
        content: 'DF(t) = 1 ÷ (1 + WACC)^(t − 0.5)',
        tags: ['discounting'],
      },
      {
        type: 'example',
        title: 'FCFF walk',
        content: 'EBIT 200, tax 25% → NOPAT 150\n+ D&A 40 − CapEx 60 − ΔNWC 10\nFCFF = 120',
        tags: ['fcff', 'worked-example'],
      },
    ],
    extracts: [
      {
        kind: 'observation',
        title: 'Mid-year convention lifts value',
        text: 'Moving from end-year to mid-year discounting raises the present value of each flow by a factor of (1 + WACC)^0.5 — roughly WACC ÷ 2. At an 8% WACC that is about +4% to EV.',
        sourceDocument: 'Personal modelling notes',
        tags: ['discounting', 'fcff'],
      },
    ],
  },
  {
    title: 'Terminal Value',
    description: 'Capture the value of cash flows beyond the explicit forecast period.',
    objectives: [
      'Choose the terminal value method',
      'Set steady-state assumptions',
      'Cross-check the implied exit multiple',
    ],
    tasks: [
      'Ensure the final forecast year is a normalised steady state',
      'Choose method: Gordon growth and/or exit multiple',
      'Set long-term growth at or below nominal GDP',
      'Check reinvestment is consistent with g and ROIC',
      'Compute implied exit multiple and compare with peers',
      'Check TV as a share of EV (often 60–80%)',
    ],
    cards: [
      {
        type: 'formula',
        title: 'Gordon growth terminal value',
        content: 'TV = FCFF(n+1) ÷ (WACC − g)\nFCFF(n+1) = FCFF(n) × (1 + g)',
        tags: ['terminal-value', 'core-formula'],
        pinned: true,
      },
      {
        type: 'formula',
        title: 'Value driver formula',
        content: 'TV = NOPAT(n+1) × (1 − g ÷ RONIC) ÷ (WACC − g)',
        tags: ['terminal-value', 'roic'],
      },
      {
        type: 'formula',
        title: 'Exit multiple method',
        content: 'TV = EBITDA(n) × Exit EV/EBITDA multiple',
        tags: ['terminal-value', 'multiples'],
      },
      {
        type: 'warning',
        title: 'g must stay below WACC and GDP',
        content:
          "As g approaches WACC, TV explodes. A perpetual growth rate above the economy's implies the company eventually becomes the economy.",
        tags: ['terminal-value', 'growth'],
      },
      {
        type: 'important',
        title: 'Discount TV from year n',
        content:
          'TV is a value at the end of year n, so discount it with the year-n factor — not n + 1. Apply any mid-year adjustment deliberately and consistently.',
        tags: ['terminal-value', 'discounting'],
      },
    ],
    extracts: [
      {
        kind: 'lesson',
        title: 'When TV dominates, revisit the forecast',
        text: 'If terminal value exceeds roughly 85% of EV, the explicit forecast is probably too short or ends before the business reaches a steady state. Extend it rather than fine-tuning g.',
        sourceDocument: 'Personal modelling notes',
        tags: ['terminal-value', 'sanity-check'],
      },
    ],
  },
  {
    title: 'Enterprise Value to Equity Value Bridge',
    description: 'Move from enterprise value to equity value and value per share.',
    objectives: [
      'Identify net debt and debt-like items',
      'Adjust for minorities and non-operating assets',
      'Compute value per share on a diluted basis',
    ],
    tasks: [
      'Deduct gross debt and lease liabilities',
      'Add cash and cash equivalents',
      'Deduct debt-like items (pensions, provisions)',
      'Deduct non-controlling interests',
      'Add associates and non-operating assets',
      'Compute diluted shares (treasury stock method)',
    ],
    cards: [
      {
        type: 'formula',
        title: 'Equity bridge',
        content:
          'Equity Value = Enterprise Value − Net Debt − Debt-like items − Minority interests + Associates + Non-operating assets',
        tags: ['bridge', 'core-formula'],
      },
      {
        type: 'formula',
        title: 'Treasury stock method',
        content: 'Net new shares = In-the-money options × (1 − Strike ÷ Share Price)',
        tags: ['bridge', 'dilution'],
      },
      {
        type: 'important',
        title: 'Bridge mirrors the FCF definition',
        content:
          "Anything whose cash flows are excluded from FCFF (e.g. associates' income) is added in the bridge. Anything whose cost is excluded (e.g. leases, pensions) is deducted.",
        tags: ['bridge', 'consistency'],
      },
    ],
  },
  {
    title: 'Sensitivity and Scenario Analysis',
    description: 'Test how the conclusion responds to the key uncertainties.',
    objectives: [
      'Identify the most sensitive inputs',
      'Build sensitivity tables',
      'Define internally consistent scenarios',
    ],
    tasks: [
      'Build a WACC × g sensitivity table',
      'Build sensitivities on margin and growth',
      'Define base, upside and downside scenarios',
      'Check scenario assumptions are internally consistent',
      'Identify break-even assumptions',
      'Summarise the valuation range',
    ],
    cards: [
      {
        type: 'concept',
        title: 'Sensitivity vs scenario',
        content:
          'A sensitivity changes one or two inputs, holding all else equal. A scenario changes a coherent set of assumptions that tell one story — e.g. a recession lowers volume, margins and CapEx together.',
        tags: ['sensitivity', 'scenarios'],
      },
      {
        type: 'decision',
        title: 'Default sensitivity ranges',
        content: 'WACC ± 1.0% in 0.5% steps\ng ± 0.5% in 0.25% steps',
        tags: ['sensitivity'],
      },
    ],
  },
  {
    title: 'Relative Valuation and Cross-Checks',
    description: 'Triangulate the DCF against market evidence.',
    objectives: [
      'Select comparable companies and transactions',
      'Compare implied multiples',
      'Reconcile material differences',
    ],
    tasks: [
      'Select trading comparables with similar growth and risk',
      'Select relevant precedent transactions',
      'Calculate EV/EBITDA, EV/EBIT and P/E on a consistent basis',
      'Compare DCF-implied multiples with peers',
      'Explain material differences',
      'Check against broker targets or consensus',
    ],
    cards: [
      {
        type: 'important',
        title: 'Multiples are shorthand DCFs',
        content:
          'EV/EBITDA embeds growth, ROIC and risk. If the DCF-implied multiple sits far above peers, identify which of the three justifies it.',
        tags: ['multiples', 'cross-check'],
      },
      {
        type: 'warning',
        title: 'Control premia in precedents',
        content:
          'Precedent transaction multiples include control premia and synergies. Do not compare them directly with a minority DCF value.',
        tags: ['multiples', 'precedents'],
      },
    ],
  },
  {
    title: 'Final Valuation Conclusion',
    description: 'Conclude on a defensible value range and document the reasoning.',
    objectives: [
      'Weight the methods and conclude',
      'Present the range visually',
      'Document key judgments and limitations',
    ],
    tasks: [
      'Summarise outputs from each method',
      'Decide method weighting and justify it',
      'Prepare the football field chart',
      'State the conclusion as a range with a point estimate',
      'Document key judgments and limitations',
      'Review the model for errors and audit trail',
    ],
    cards: [
      {
        type: 'decision',
        title: 'Conclusion statement',
        content:
          'Based on the DCF (primary), cross-checked against trading multiples, equity value is in the range [X]–[Y], with a point estimate of [Z].',
        tags: ['template', 'conclusion'],
      },
      {
        type: 'important',
        title: 'Read the story back',
        content:
          'Read the conclusion back as a narrative. Do the implied growth, margins and returns make sense for this business in this industry?',
        tags: ['conclusion', 'sanity-check'],
      },
    ],
  },
];


/** Writes the starter journal inside Dexie's 'populate' transaction. */
export function seedDatabase(tx: Transaction) {
  const now = Date.now();
  const journal: Journal = {
    id: DEFAULT_JOURNAL_ID,
    name: 'DCF Valuation',
    description: 'Discounted cash flow valuation workflow',
    createdAt: now,
    updatedAt: now,
  };

  const phases: Phase[] = [];
  const tasks: ChecklistItem[] = [];
  const cards: KnowledgeCard[] = [];
  const extracts: KnowledgeExtract[] = [];

  SEED_PHASES.forEach((seed, phaseIndex) => {
    const phaseId = uid();
    phases.push({
      id: phaseId,
      journalId: DEFAULT_JOURNAL_ID,
      order: phaseIndex,
      title: seed.title,
      description: seed.description,
      objectives: seed.objectives,
      createdAt: now,
      updatedAt: now,
    });
    seed.tasks.forEach((text, i) =>
      tasks.push({ id: uid(), phaseId, text, done: false, order: i, createdAt: now, updatedAt: now }),
    );
    seed.cards.forEach((card, i) =>
      cards.push({
        id: uid(),
        phaseId,
        type: card.type,
        title: card.title,
        content: card.content,
        tags: card.tags,
        pinned: card.pinned ?? false,
        order: i,
        source: card.source,
        createdAt: now,
        updatedAt: now,
      }),
    );
    seed.extracts?.forEach((extract) =>
      extracts.push({ id: uid(), phaseId, pinned: false, ...extract, createdAt: now, updatedAt: now }),
    );
  });

  tx.table('journals').add(journal);
  tx.table('phases').bulkAdd(phases);
  tx.table('checklist').bulkAdd(tasks);
  tx.table('cards').bulkAdd(cards);
  tx.table('extracts').bulkAdd(extracts);
}
