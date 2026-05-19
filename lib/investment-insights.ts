import { db } from "@/lib/db";

export interface InsightMetricValue {
  value: number | null;
  sectorMedian: number | null;
  favorablePercentile: number | null;
  label: string;
}

export interface SectorRelativeInsight {
  sector: string | null;
  country: string;
  peerCount: number;
  per: InsightMetricValue;
  pbr: InsightMetricValue;
  roe: InsightMetricValue;
}

export interface GrowthTrendInsight {
  latestYear: string | null;
  previousYear: string | null;
  netIncomeGrowth: number | null;
  operatingIncomeGrowth: number | null;
  equityGrowth: number | null;
  label: string;
  summary: string;
}

export interface QualityScoreComponent {
  label: string;
  score: number;
  maxScore: number;
  note: string;
}

export interface QualityScoreInsight {
  score: number | null;
  grade: string;
  components: QualityScoreComponent[];
  summary: string;
}

export interface InvestmentInsights {
  sectorRelative: SectorRelativeInsight;
  growthTrend: GrowthTrendInsight;
  qualityScore: QualityScoreInsight;
}

export interface InsightStockInput {
  code: string;
  country: string;
  gics_sector: string | null;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  equity: number | null;
  net_income: number | null;
  operating_income: number | null;
  debt_ratio: number | null;
}

interface PeerMetricRow {
  per: number | null;
  pbr: number | null;
  roe: number | null;
}

interface HistoricalMetricRow {
  bsnsYear: string | null;
  snapshotDate: string;
  equity: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanNumbers(values: Array<number | null | undefined>) {
  return values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
}

function median(values: Array<number | null | undefined>) {
  const numbers = cleanNumbers(values).sort((a, b) => a - b);
  if (numbers.length === 0) return null;
  const middle = Math.floor(numbers.length / 2);
  if (numbers.length % 2 === 1) return numbers[middle];
  return (numbers[middle - 1] + numbers[middle]) / 2;
}

function favorablePercentile(
  value: number | null,
  values: Array<number | null | undefined>,
  higherIsBetter: boolean
) {
  if (value === null) return null;
  const numbers = cleanNumbers(values);
  if (numbers.length === 0) return null;

  const favorableCount = higherIsBetter
    ? numbers.filter((item) => item <= value).length
    : numbers.filter((item) => item >= value).length;

  return (favorableCount / numbers.length) * 100;
}

function valuationLabel(
  value: number | null,
  percentile: number | null,
  higherIsBetter: boolean
) {
  if (value === null || percentile === null) return "데이터 부족";

  if (higherIsBetter) {
    if (percentile >= 80) return "섹터 상위권";
    if (percentile >= 60) return "섹터 평균 이상";
    if (percentile <= 25) return "섹터 하위권";
    return "섹터 중간권";
  }

  if (percentile >= 80) return "섹터 대비 낮은 밸류";
  if (percentile >= 60) return "섹터 평균보다 낮음";
  if (percentile <= 25) return "섹터 대비 높은 밸류";
  return "섹터 중간권";
}

function buildMetricInsight(
  value: number | null,
  peerValues: Array<number | null | undefined>,
  higherIsBetter: boolean
): InsightMetricValue {
  const percentile = favorablePercentile(value, peerValues, higherIsBetter);

  return {
    value,
    sectorMedian: median(peerValues),
    favorablePercentile: percentile,
    label: valuationLabel(value, percentile, higherIsBetter),
  };
}

function emptyMetricInsight(value: number | null, higherIsBetter: boolean) {
  return buildMetricInsight(value, [], higherIsBetter);
}

function growthRate(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function growthLabel(values: Array<number | null>) {
  const available = cleanNumbers(values);
  if (available.length === 0) return "이력 부족";

  const positiveCount = available.filter((value) => value > 0).length;
  const negativeCount = available.filter((value) => value < 0).length;

  if (positiveCount === available.length) return "성장 우위";
  if (negativeCount === available.length) return "감소 추세";
  if (positiveCount > negativeCount) return "혼합 성장";
  return "방향성 확인 필요";
}

function growthSummary(insight: GrowthTrendInsight) {
  if (!insight.latestYear || !insight.previousYear) {
    return "동일 기준의 과거 재무 이력이 부족해 성장률 판단을 보류합니다.";
  }

  const parts = [
    insight.netIncomeGrowth !== null ? "순이익" : "",
    insight.operatingIncomeGrowth !== null ? "영업이익" : "",
    insight.equityGrowth !== null ? "자본" : "",
  ].filter(Boolean);

  if (parts.length === 0) {
    return "전년 대비 계산에 필요한 재무 항목이 부족합니다.";
  }

  return `${insight.previousYear}년 대비 ${insight.latestYear}년 ${parts.join(
    ", "
  )} 변화율을 기준으로 판단했습니다.`;
}

function scoreRoe(roe: number | null): QualityScoreComponent {
  if (roe === null) {
    return { label: "수익성", score: 0, maxScore: 35, note: "ROE 데이터 부족" };
  }
  if (roe >= 20) {
    return { label: "수익성", score: 35, maxScore: 35, note: "ROE 20% 이상" };
  }
  if (roe >= 15) {
    return { label: "수익성", score: 30, maxScore: 35, note: "ROE 15% 이상" };
  }
  if (roe >= 10) {
    return { label: "수익성", score: 24, maxScore: 35, note: "ROE 10% 이상" };
  }
  if (roe > 0) {
    return { label: "수익성", score: 14, maxScore: 35, note: "흑자 ROE" };
  }
  return { label: "수익성", score: 3, maxScore: 35, note: "ROE 적자/음수" };
}

function scoreDebt(debtRatio: number | null): QualityScoreComponent {
  if (debtRatio === null) {
    return {
      label: "재무 안정성",
      score: 0,
      maxScore: 25,
      note: "부채비율 데이터 부족",
    };
  }
  if (debtRatio <= 50) {
    return { label: "재무 안정성", score: 25, maxScore: 25, note: "부채비율 50% 이하" };
  }
  if (debtRatio <= 100) {
    return { label: "재무 안정성", score: 20, maxScore: 25, note: "부채비율 100% 이하" };
  }
  if (debtRatio <= 200) {
    return { label: "재무 안정성", score: 12, maxScore: 25, note: "부채비율 200% 이하" };
  }
  return { label: "재무 안정성", score: 4, maxScore: 25, note: "부채 부담 높음" };
}

function scoreEarningsQuality(
  netIncome: number | null,
  operatingIncome: number | null
): QualityScoreComponent {
  if (netIncome === null && operatingIncome === null) {
    return { label: "이익의 질", score: 0, maxScore: 20, note: "이익 데이터 부족" };
  }
  if ((netIncome ?? 0) > 0 && (operatingIncome ?? 0) > 0) {
    const ratio =
      netIncome !== null && operatingIncome !== null && operatingIncome !== 0
        ? netIncome / operatingIncome
        : null;
    if (ratio !== null && ratio >= 0.4 && ratio <= 1.4) {
      return {
        label: "이익의 질",
        score: 20,
        maxScore: 20,
        note: "영업이익과 순이익 모두 양호",
      };
    }
    return {
      label: "이익의 질",
      score: 16,
      maxScore: 20,
      note: "영업이익과 순이익 모두 흑자",
    };
  }
  if ((netIncome ?? 0) > 0 || (operatingIncome ?? 0) > 0) {
    return { label: "이익의 질", score: 9, maxScore: 20, note: "일부 이익 항목만 흑자" };
  }
  return { label: "이익의 질", score: 2, maxScore: 20, note: "영업/순이익 적자" };
}

function scoreGrowth(growth: GrowthTrendInsight): QualityScoreComponent {
  const values = cleanNumbers([
    growth.netIncomeGrowth,
    growth.operatingIncomeGrowth,
    growth.equityGrowth,
  ]);
  if (values.length === 0) {
    return { label: "성장 지속성", score: 0, maxScore: 20, note: "성장률 이력 부족" };
  }
  const positiveCount = values.filter((value) => value > 0).length;
  if (positiveCount === values.length) {
    return { label: "성장 지속성", score: 20, maxScore: 20, note: "주요 항목 모두 성장" };
  }
  if (positiveCount >= 2) {
    return { label: "성장 지속성", score: 15, maxScore: 20, note: "주요 항목 다수 성장" };
  }
  if (positiveCount === 1) {
    return { label: "성장 지속성", score: 8, maxScore: 20, note: "일부 항목 성장" };
  }
  return { label: "성장 지속성", score: 3, maxScore: 20, note: "성장 항목 부족" };
}

function qualityGrade(score: number | null) {
  if (score === null) return "N/A";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}

function buildQualityScore(
  stock: InsightStockInput,
  growth: GrowthTrendInsight
): QualityScoreInsight {
  const components = [
    scoreRoe(stock.roe),
    scoreDebt(stock.debt_ratio),
    scoreEarningsQuality(stock.net_income, stock.operating_income),
    scoreGrowth(growth),
  ];
  const availableComponents = components.filter((component) => component.maxScore > 0);
  const hasAnyData = components.some((component) => component.score > 0);
  const score = hasAnyData
    ? Math.round(
        availableComponents.reduce((sum, component) => sum + component.score, 0)
      )
    : null;
  const grade = qualityGrade(score);

  return {
    score,
    grade,
    components,
    summary:
      score === null
        ? "품질 점수를 계산할 재무 데이터가 부족합니다."
        : `수익성, 재무 안정성, 이익의 질, 성장 지속성을 100점 기준으로 합산했습니다.`,
  };
}

async function loadPeerMetrics(country: string, sector: string) {
  const result = await db.execute({
    sql: `WITH latest AS (
            SELECT code, country, MAX(snapshot_date) AS snapshot_date
            FROM metrics_history
            GROUP BY code, country
          )
          SELECT m.per, m.pbr, m.roe
          FROM companies c
          JOIN latest l
            ON l.code = c.code AND l.country = c.country
          JOIN metrics_history m
            ON m.code = l.code
           AND m.country = l.country
           AND m.snapshot_date = l.snapshot_date
          WHERE c.country = ?
            AND c.gics_sector = ?
            AND (m.per IS NOT NULL OR m.pbr IS NOT NULL OR m.roe IS NOT NULL)`,
    args: [country, sector],
  });

  return result.rows.map((row) => ({
    per: toNumber(row.per),
    pbr: toNumber(row.pbr),
    roe: toNumber(row.roe),
  })) satisfies PeerMetricRow[];
}

async function loadHistoricalMetrics(code: string, country: string) {
  const result = await db.execute({
    sql: `SELECT
            bsns_year AS bsnsYear,
            snapshot_date AS snapshotDate,
            equity,
            net_income AS netIncome,
            operating_income AS operatingIncome
          FROM metrics_history
          WHERE code = ?
            AND country = ?
            AND bsns_year IS NOT NULL
            AND bsns_year != ''
          ORDER BY CAST(bsns_year AS INTEGER) DESC, snapshot_date DESC`,
    args: [code, country],
  });

  const byYear = new Map<string, HistoricalMetricRow>();
  for (const row of result.rows) {
    const year = typeof row.bsnsYear === "string" ? row.bsnsYear : null;
    if (!year || byYear.has(year)) continue;
    byYear.set(year, {
      bsnsYear: year,
      snapshotDate: String(row.snapshotDate || ""),
      equity: toNumber(row.equity),
      netIncome: toNumber(row.netIncome),
      operatingIncome: toNumber(row.operatingIncome),
    });
  }

  return Array.from(byYear.values());
}

function buildGrowthTrend(rows: HistoricalMetricRow[]): GrowthTrendInsight {
  const latest = rows[0];
  const previous = rows[1];

  if (!latest || !previous) {
    const insight: GrowthTrendInsight = {
      latestYear: latest?.bsnsYear || null,
      previousYear: null,
      netIncomeGrowth: null,
      operatingIncomeGrowth: null,
      equityGrowth: null,
      label: "이력 부족",
      summary: "동일 기준의 과거 재무 이력이 부족해 성장률 판단을 보류합니다.",
    };
    return insight;
  }

  const insight: GrowthTrendInsight = {
    latestYear: latest.bsnsYear,
    previousYear: previous.bsnsYear,
    netIncomeGrowth: growthRate(latest.netIncome, previous.netIncome),
    operatingIncomeGrowth: growthRate(
      latest.operatingIncome,
      previous.operatingIncome
    ),
    equityGrowth: growthRate(latest.equity, previous.equity),
    label: "이력 부족",
    summary: "",
  };

  insight.label = growthLabel([
    insight.netIncomeGrowth,
    insight.operatingIncomeGrowth,
    insight.equityGrowth,
  ]);
  insight.summary = growthSummary(insight);

  return insight;
}

function buildSectorRelative(
  stock: InsightStockInput,
  peers: PeerMetricRow[]
): SectorRelativeInsight {
  const peerCount = peers.length;
  return {
    sector: stock.gics_sector,
    country: stock.country,
    peerCount,
    per:
      peerCount > 0
        ? buildMetricInsight(stock.per, peers.map((peer) => peer.per), false)
        : emptyMetricInsight(stock.per, false),
    pbr:
      peerCount > 0
        ? buildMetricInsight(stock.pbr, peers.map((peer) => peer.pbr), false)
        : emptyMetricInsight(stock.pbr, false),
    roe:
      peerCount > 0
        ? buildMetricInsight(stock.roe, peers.map((peer) => peer.roe), true)
        : emptyMetricInsight(stock.roe, true),
  };
}

export async function buildInvestmentInsights(
  stocks: InsightStockInput[]
): Promise<Map<string, InvestmentInsights>> {
  const peerCache = new Map<string, Promise<PeerMetricRow[]>>();

  const getPeers = (stock: InsightStockInput) => {
    if (!stock.gics_sector) return Promise.resolve([]);
    const key = `${stock.country}:${stock.gics_sector}`;
    if (!peerCache.has(key)) {
      peerCache.set(key, loadPeerMetrics(stock.country, stock.gics_sector));
    }
    return peerCache.get(key)!;
  };

  const entries = await Promise.all(
    stocks.map(async (stock) => {
      const [peers, history] = await Promise.all([
        getPeers(stock),
        loadHistoricalMetrics(stock.code, stock.country),
      ]);
      const growthTrend = buildGrowthTrend(history);
      const insights: InvestmentInsights = {
        sectorRelative: buildSectorRelative(stock, peers),
        growthTrend,
        qualityScore: buildQualityScore(stock, growthTrend),
      };

      return [`${stock.country}:${stock.code}`, insights] as const;
    })
  );

  return new Map(entries);
}
