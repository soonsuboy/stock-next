export const GICS_SECTORS = [
  "정보기술",
  "헬스케어",
  "경기소비재",
  "필수소비재",
  "금융",
  "커뮤니케이션",
  "산업재",
  "소재",
  "에너지",
  "유틸리티",
  "부동산",
] as const;

export type GicsSector = (typeof GICS_SECTORS)[number];

export interface GicsSectorGuide {
  per: string;
  pbr: string;
  roe: string;
  summary: string;
}

export const GICS_SECTOR_GUIDES: Record<GicsSector, GicsSectorGuide> = {
  정보기술: {
    per: "25~40+",
    pbr: "3~5+",
    roe: "15%+",
    summary:
      "무형자산 중심 및 높은 성장성이 반영되는 섹터입니다. 반도체 등 하드웨어는 사이클 변동에 주의해야 합니다.",
  },
  헬스케어: {
    per: "예측 불허",
    pbr: "높음",
    roe: "예측 불허",
    summary:
      "적자 기업도 많고 신약 임상 기대감이 반영됩니다. 전통 재무지표보다 파이프라인 가치가 중요합니다.",
  },
  경기소비재: {
    per: "8~15",
    pbr: "0.5~1.2",
    roe: "업종별 편차",
    summary:
      "대규모 설비 투자가 필요하고 경기 영향을 크게 받습니다. 경기 정점 여부를 함께 확인하는 편이 좋습니다.",
  },
  필수소비재: {
    per: "12~18",
    pbr: "1~2",
    roe: "10~15%",
    summary:
      "경기 방어주 성격이 강합니다. 꾸준한 이익, 배당 성향, 브랜드 안정성을 중심으로 봅니다.",
  },
  금융: {
    per: "4~8",
    pbr: "0.3~0.7",
    roe: "규제/금리 영향",
    summary:
      "규제 산업이자 고배당 섹터입니다. 일반 제조업과 재무 구조가 달라 낮은 PER/PBR을 그대로 저평가로 보기 어렵습니다.",
  },
  커뮤니케이션: {
    per: "20~35",
    pbr: "3~6",
    roe: "15%+",
    summary:
      "플랫폼과 엔터테인먼트 기업의 글로벌 확장성, 높은 영업레버리지 효과가 지표에 반영됩니다.",
  },
  산업재: {
    per: "사이클에 따라 왜곡",
    pbr: "역사적 밴드 권장",
    roe: "사이클 민감",
    summary:
      "경기민감주입니다. 불황기에는 고PER/적자, 호황기에는 저PER이 나타날 수 있어 역사적 PBR 밴드가 유용합니다.",
  },
  소재: {
    per: "사이클에 따라 왜곡",
    pbr: "역사적 밴드 권장",
    roe: "사이클 민감",
    summary:
      "경기민감주입니다. 원자재 가격과 수급 사이클 영향을 크게 받으므로 PER보다 역사적 PBR 밴드를 함께 봅니다.",
  },
  에너지: {
    per: "사이클에 따라 왜곡",
    pbr: "역사적 밴드 권장",
    roe: "유가/스프레드 민감",
    summary:
      "유가와 정제마진 사이클이 핵심입니다. 호황기 저PER, 불황기 고PER 또는 적자가 나타날 수 있습니다.",
  },
  유틸리티: {
    per: "8~12",
    pbr: "0.2~0.8",
    roe: "4~8%",
    summary:
      "국가 규제와 안정적 현금흐름이 핵심입니다. 성장성보다 배당, 요금 정책, 부채비율을 함께 봅니다.",
  },
  부동산: {
    per: "8~12",
    pbr: "0.2~0.8",
    roe: "4~8%",
    summary:
      "임대 수익과 자산가치 중심 섹터입니다. 금리, 공실률, 배당 안정성을 같이 확인하는 편이 좋습니다.",
  },
};

export const KRX_INDUSTRY_TO_GICS: Record<string, GicsSector> = {
  전기전자: "정보기술",
  의료정밀: "헬스케어",
  의약품: "헬스케어",
  운수장비: "경기소비재",
  유통업: "경기소비재",
  섬유의복: "경기소비재",
  음식료품: "필수소비재",
  금융업: "금융",
  보험: "금융",
  증권: "금융",
  통신업: "커뮤니케이션",
  서비스업: "커뮤니케이션",
  기계: "산업재",
  운수창고: "산업재",
  건설업: "산업재",
  화학: "소재",
  철강금속: "소재",
  비금속광물: "소재",
  전기가스업: "유틸리티",
  부동산: "부동산",
};

export const US_INDUSTRY_TO_GICS: Record<string, GicsSector> = {
  "Information Technology": "정보기술",
  Semiconductors: "정보기술",
  Software: "정보기술",
  Hardware: "정보기술",
  "Health Care": "헬스케어",
  Biotechnology: "헬스케어",
  Pharmaceuticals: "헬스케어",
  "Consumer Discretionary": "경기소비재",
  Automobiles: "경기소비재",
  Retail: "경기소비재",
  "Consumer Staples": "필수소비재",
  Food: "필수소비재",
  Beverages: "필수소비재",
  Financials: "금융",
  Banks: "금융",
  Insurance: "금융",
  "Communication Services": "커뮤니케이션",
  Media: "커뮤니케이션",
  Entertainment: "커뮤니케이션",
  Industrials: "산업재",
  Aerospace: "산업재",
  Machinery: "산업재",
  Materials: "소재",
  Chemicals: "소재",
  Metals: "소재",
  Energy: "에너지",
  Oil: "에너지",
  Utilities: "유틸리티",
  "Real Estate": "부동산",
  REIT: "부동산",
};

const KR_CODE_TO_GICS: Record<string, GicsSector> = {
  "005930": "정보기술",
  "000660": "정보기술",
  "035420": "커뮤니케이션",
  "035720": "커뮤니케이션",
  "207940": "헬스케어",
  "068270": "헬스케어",
  "005380": "경기소비재",
  "000270": "경기소비재",
  "055550": "금융",
  "105560": "금융",
  "051910": "소재",
  "096770": "에너지",
  "015760": "유틸리티",
};

const US_SYMBOL_TO_GICS: Record<string, GicsSector> = {
  AAPL: "정보기술",
  MSFT: "정보기술",
  NVDA: "정보기술",
  AVGO: "정보기술",
  AMD: "정보기술",
  TSM: "정보기술",
  GOOGL: "커뮤니케이션",
  GOOG: "커뮤니케이션",
  META: "커뮤니케이션",
  NFLX: "커뮤니케이션",
  AMZN: "경기소비재",
  TSLA: "경기소비재",
  HD: "경기소비재",
  MCD: "경기소비재",
  WMT: "필수소비재",
  COST: "필수소비재",
  PG: "필수소비재",
  KO: "필수소비재",
  PEP: "필수소비재",
  JPM: "금융",
  BAC: "금융",
  BRK_B: "금융",
  BRK_B_ALT: "금융",
  V: "금융",
  MA: "금융",
  LLY: "헬스케어",
  UNH: "헬스케어",
  JNJ: "헬스케어",
  MRK: "헬스케어",
  XOM: "에너지",
  CVX: "에너지",
  LIN: "소재",
  CAT: "산업재",
  GE: "산업재",
  NEE: "유틸리티",
  PLD: "부동산",
};

const NAME_KEYWORDS: Array<[RegExp, GicsSector]> = [
  [/semiconductor|software|technology|systems|data|cloud|chip|반도체|전자|소프트웨어|테크/i, "정보기술"],
  [/pharma|bio|health|medical|therapeutics|병원|제약|바이오|헬스케어/i, "헬스케어"],
  [/auto|motor|vehicle|apparel|hotel|travel|restaurant|자동차|모빌리티|호텔|여행|백화점/i, "경기소비재"],
  [/food|beverage|consumer|grocery|tobacco|식품|음료|생활용품|화장품/i, "필수소비재"],
  [/bank|financial|capital|insurance|asset|securities|은행|금융|증권|보험|카드/i, "금융"],
  [/communication|telecom|media|entertainment|interactive|platform|통신|미디어|엔터|게임|플랫폼/i, "커뮤니케이션"],
  [/industrial|aerospace|machinery|logistics|construction|건설|기계|항공|물류|조선/i, "산업재"],
  [/chemical|materials|steel|metal|mining|화학|소재|철강|금속/i, "소재"],
  [/energy|oil|gas|petroleum|refining|에너지|정유|가스|석유/i, "에너지"],
  [/utilities|utility|electric|power|water|전력|전기|가스공사|수자원/i, "유틸리티"],
  [/reit|real estate|property|부동산|리츠/i, "부동산"],
];

export function normalizeGicsSector(value: unknown): GicsSector | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return GICS_SECTORS.includes(trimmed as GicsSector)
    ? (trimmed as GicsSector)
    : null;
}

export function inferGicsSector(input: {
  code?: string | null;
  country?: string | null;
  name?: string | null;
  market?: string | null;
  industryName?: string | null;
}): GicsSector | null {
  const country = (input.country || "").toUpperCase();
  const code = (input.code || "").toUpperCase().replace(".", "-");
  const krCode = code.padStart(6, "0");
  if (country === "KR" && KR_CODE_TO_GICS[krCode]) return KR_CODE_TO_GICS[krCode];
  if (country === "US") {
    const normalized = code.replace("-", "_");
    if (US_SYMBOL_TO_GICS[normalized]) return US_SYMBOL_TO_GICS[normalized];
    if (code === "BRK-B") return "금융";
  }

  const industry = (input.industryName || input.market || "").trim();
  if (industry) {
    const exact =
      country === "KR"
        ? KRX_INDUSTRY_TO_GICS[industry]
        : US_INDUSTRY_TO_GICS[industry];
    if (exact) return exact;

    for (const [keyword, sector] of Object.entries(
      country === "KR" ? KRX_INDUSTRY_TO_GICS : US_INDUSTRY_TO_GICS
    )) {
      if (industry.toLowerCase().includes(keyword.toLowerCase())) return sector;
    }
  }

  const name = input.name || "";
  for (const [pattern, sector] of NAME_KEYWORDS) {
    if (pattern.test(name)) return sector;
  }

  return null;
}
