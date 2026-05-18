import { inferGicsSector, normalizeGicsSector } from "@/lib/gics-sector";

export interface CompanyProfile {
  overview: string;
  productsServices: string[];
  profileSource: "curated" | "sector_fallback";
}

interface CompanyProfileInput {
  code: string;
  country: string;
  name: string;
  market?: string | null;
  gicsSector?: string | null;
  industryName?: string | null;
}

const CURATED_PROFILES: Record<string, CompanyProfile> = {
  "KR:005930": {
    overview:
      "삼성전자는 메모리 반도체, 모바일 기기, 디스플레이, 가전 등을 전 세계에 공급하는 한국 대표 종합 전자 기업입니다.",
    productsServices: [
      "메모리 반도체",
      "스마트폰",
      "디스플레이 패널",
      "TV와 생활가전",
    ],
    profileSource: "curated",
  },
  "KR:000660": {
    overview:
      "SK하이닉스는 DRAM과 NAND Flash 등 메모리 반도체를 중심으로 데이터센터, 모바일, PC 시장에 부품을 공급하는 반도체 기업입니다.",
    productsServices: ["DRAM", "NAND Flash", "HBM", "기업용 SSD"],
    profileSource: "curated",
  },
  "KR:005380": {
    overview:
      "현대차는 승용차, SUV, 상용차와 전기차를 제조·판매하며 모빌리티 서비스와 수소 생태계로 사업을 확장하는 완성차 기업입니다.",
    productsServices: ["승용차", "SUV", "전기차", "수소차와 모빌리티 서비스"],
    profileSource: "curated",
  },
  "KR:000270": {
    overview:
      "기아는 승용차, SUV, 전기차를 글로벌 시장에 판매하는 완성차 기업으로, 디자인과 친환경차 라인업을 핵심 경쟁력으로 삼고 있습니다.",
    productsServices: ["승용차", "SUV", "전기차", "커넥티드카 서비스"],
    profileSource: "curated",
  },
  "KR:035420": {
    overview:
      "NAVER는 검색, 커머스, 콘텐츠, 핀테크, 클라우드 서비스를 운영하는 한국 대표 인터넷 플랫폼 기업입니다.",
    productsServices: ["검색 광고", "커머스", "웹툰과 콘텐츠", "클라우드"],
    profileSource: "curated",
  },
  "KR:035720": {
    overview:
      "카카오는 메신저 기반 플랫폼을 중심으로 광고, 커머스, 콘텐츠, 모빌리티, 금융 서비스를 운영하는 인터넷 플랫폼 기업입니다.",
    productsServices: ["카카오톡", "광고와 커머스", "콘텐츠", "모빌리티와 금융 서비스"],
    profileSource: "curated",
  },
  "KR:207940": {
    overview:
      "삼성바이오로직스는 글로벌 제약사를 대상으로 바이오의약품 위탁개발·생산 서비스를 제공하는 CDMO 기업입니다.",
    productsServices: ["바이오의약품 위탁생산", "세포주 개발", "공정 개발", "품질 분석"],
    profileSource: "curated",
  },
  "KR:068270": {
    overview:
      "셀트리온은 바이오시밀러와 항체 의약품을 개발·생산해 글로벌 시장에 공급하는 바이오 제약 기업입니다.",
    productsServices: ["바이오시밀러", "항체 의약품", "의약품 생산", "글로벌 의약품 판매"],
    profileSource: "curated",
  },
  "US:AAPL": {
    overview:
      "Apple은 프리미엄 하드웨어, 운영체제, 앱 생태계, 구독 서비스를 결합해 소비자 전자제품과 디지털 서비스를 판매하는 기업입니다.",
    productsServices: ["iPhone", "Mac과 iPad", "웨어러블", "App Store와 구독 서비스"],
    profileSource: "curated",
  },
  "US:MSFT": {
    overview:
      "Microsoft는 클라우드, 기업용 소프트웨어, 운영체제, 생산성 도구, 게임 플랫폼을 제공하는 글로벌 소프트웨어 기업입니다.",
    productsServices: ["Azure", "Microsoft 365", "Windows", "Xbox와 게임"],
    profileSource: "curated",
  },
  "US:NVDA": {
    overview:
      "NVIDIA는 GPU와 AI 가속 컴퓨팅 플랫폼을 중심으로 데이터센터, 게임, 전문 시각화, 자동차 시장에 반도체와 소프트웨어를 공급합니다.",
    productsServices: ["AI GPU", "데이터센터 가속기", "게임 GPU", "AI 소프트웨어 플랫폼"],
    profileSource: "curated",
  },
  "US:GOOGL": {
    overview:
      "Alphabet은 Google 검색과 광고, YouTube, Android, 클라우드, AI 서비스를 운영하는 글로벌 인터넷 플랫폼 기업입니다.",
    productsServices: ["검색 광고", "YouTube", "Android", "Google Cloud"],
    profileSource: "curated",
  },
  "US:GOOG": {
    overview:
      "Alphabet은 Google 검색과 광고, YouTube, Android, 클라우드, AI 서비스를 운영하는 글로벌 인터넷 플랫폼 기업입니다.",
    productsServices: ["검색 광고", "YouTube", "Android", "Google Cloud"],
    profileSource: "curated",
  },
  "US:META": {
    overview:
      "Meta Platforms는 Facebook, Instagram, WhatsApp 기반의 소셜 네트워크와 광고 플랫폼, 메타버스·AI 인프라를 운영합니다.",
    productsServices: ["소셜 네트워크", "디지털 광고", "메신저", "VR/AR 기기"],
    profileSource: "curated",
  },
  "US:AMZN": {
    overview:
      "Amazon은 전자상거래, 물류, 클라우드, 광고, 구독 서비스를 운영하는 글로벌 플랫폼 기업입니다.",
    productsServices: ["온라인 리테일", "AWS", "물류 서비스", "광고와 Prime"],
    profileSource: "curated",
  },
  "US:TSLA": {
    overview:
      "Tesla는 전기차, 에너지 저장장치, 태양광, 자율주행 소프트웨어를 중심으로 사업을 운영하는 모빌리티·에너지 기업입니다.",
    productsServices: ["전기차", "배터리 저장장치", "충전 네트워크", "자율주행 소프트웨어"],
    profileSource: "curated",
  },
  "US:ASML": {
    overview:
      "ASML은 반도체 미세공정에 필요한 노광 장비를 공급하는 장비 기업으로, EUV 노광 장비가 핵심 경쟁력입니다.",
    productsServices: ["EUV 노광 장비", "DUV 노광 장비", "계측 장비", "장비 유지보수 서비스"],
    profileSource: "curated",
  },
  "US:TSM": {
    overview:
      "TSMC는 팹리스 반도체 기업을 대상으로 첨단 공정 기반의 위탁생산 서비스를 제공하는 글로벌 파운드리 기업입니다.",
    productsServices: ["반도체 파운드리", "첨단 로직 공정", "패키징", "공정 설계 지원"],
    profileSource: "curated",
  },
  "US:JPM": {
    overview:
      "JPMorgan Chase는 소비자 금융, 기업금융, 투자은행, 자산관리 서비스를 제공하는 미국 대형 금융그룹입니다.",
    productsServices: ["소비자 금융", "기업 대출", "투자은행", "자산관리"],
    profileSource: "curated",
  },
  "US:WMT": {
    overview:
      "Walmart는 대형 할인점, 식료품, 온라인 커머스, 멤버십 서비스를 운영하는 글로벌 소매 유통 기업입니다.",
    productsServices: ["오프라인 매장", "식료품 유통", "전자상거래", "멤버십 서비스"],
    profileSource: "curated",
  },
};

const SECTOR_FALLBACKS: Record<
  string,
  { business: string; productsServices: string[] }
> = {
  정보기술: {
    business: "기술 제품, 소프트웨어, 반도체, IT 인프라를 통해 매출을 만드는 기업입니다.",
    productsServices: ["하드웨어", "소프트웨어", "반도체/부품", "IT 서비스"],
  },
  헬스케어: {
    business: "의약품, 바이오, 의료기기, 헬스케어 서비스를 중심으로 사업을 운영하는 기업입니다.",
    productsServices: ["의약품", "바이오 제품", "의료기기", "헬스케어 서비스"],
  },
  경기소비재: {
    business: "자동차, 유통, 여행, 의류 등 경기 흐름에 민감한 소비재와 서비스를 판매하는 기업입니다.",
    productsServices: ["내구소비재", "자동차/부품", "리테일", "소비자 서비스"],
  },
  필수소비재: {
    business: "식품, 생활용품, 유통 등 경기 변동에도 수요가 비교적 안정적인 제품을 판매하는 기업입니다.",
    productsServices: ["식품", "음료", "생활용품", "필수재 유통"],
  },
  금융: {
    business: "예대마진, 수수료, 투자, 보험, 자산관리 등 금융 서비스를 통해 수익을 창출하는 기업입니다.",
    productsServices: ["대출", "예금", "투자 서비스", "보험/자산관리"],
  },
  커뮤니케이션: {
    business: "통신, 미디어, 인터넷 플랫폼, 콘텐츠 서비스를 통해 사용자 기반 수익을 만드는 기업입니다.",
    productsServices: ["통신 서비스", "디지털 광고", "콘텐츠", "플랫폼 서비스"],
  },
  산업재: {
    business: "기계, 항공, 물류, 건설, 제조 장비 등 기업과 인프라 투자에 필요한 제품과 서비스를 공급합니다.",
    productsServices: ["산업 장비", "물류/운송", "건설 서비스", "기업용 솔루션"],
  },
  소재: {
    business: "화학, 금속, 철강, 원자재 등 제조업의 기초 소재를 생산·공급하는 기업입니다.",
    productsServices: ["화학 소재", "금속/철강", "산업 원재료", "특수 소재"],
  },
  에너지: {
    business: "석유, 가스, 정유, 에너지 인프라와 관련된 제품과 서비스를 제공하는 기업입니다.",
    productsServices: ["석유/가스", "정유 제품", "에너지 인프라", "발전 연료"],
  },
  유틸리티: {
    business: "전력, 가스, 수도 등 공공 인프라형 서비스를 안정적으로 공급하는 기업입니다.",
    productsServices: ["전력", "가스", "수도", "공공 인프라 서비스"],
  },
  부동산: {
    business: "부동산 개발, 임대, 운영, 리츠 등 자산 기반 수익을 중심으로 하는 기업입니다.",
    productsServices: ["부동산 임대", "자산 운영", "개발 사업", "리츠"],
  },
};

function profileKey(country: string, code: string) {
  return `${country.toUpperCase()}:${code.toUpperCase().replace(".", "-")}`;
}

export function buildCompanyProfile(input: CompanyProfileInput): CompanyProfile {
  const key = profileKey(input.country, input.code);
  if (CURATED_PROFILES[key]) return CURATED_PROFILES[key];

  const sector =
    normalizeGicsSector(input.gicsSector) ||
    inferGicsSector({
      code: input.code,
      country: input.country,
      name: input.name,
      market: input.market,
      industryName: input.industryName,
    });
  const fallback = sector ? SECTOR_FALLBACKS[sector] : null;

  if (fallback) {
    return {
      overview: `${input.name}은(는) ${sector} 섹터에 속하며, ${fallback.business}`,
      productsServices: fallback.productsServices,
      profileSource: "sector_fallback",
    };
  }

  return {
    overview:
      `${input.name}은(는) ${input.market || input.country} 시장에 상장된 기업입니다. ` +
      "상세 사업 설명은 아직 DB에 별도로 등록되지 않았습니다.",
    productsServices: ["주요 사업", "제품/서비스", "시장 판매", "기업 운영"],
    profileSource: "sector_fallback",
  };
}
