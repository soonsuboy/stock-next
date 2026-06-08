export type BusinessCard = {
  id: string;
  slug: string;
  nameKo: string;
  nameEn: string;
  familyName: string;
  givenName: string;
  title: string;
  organization: string;
  department: string;
  email: string;
  mobile: string;
  office: string;
  address: string;
  website: string;
};

export const kidaCard: BusinessCard = {
  id: "seo-daewoong",
  slug: "seo-daewoong",
  nameKo: "서대웅",
  nameEn: "Seo Daewoong",
  familyName: "서",
  givenName: "대웅",
  title: "선임연구원",
  organization: "한국국방연구원",
  department: "국방정보체계관리단",
  email: "soonsuboy@kida.re.kr",
  mobile: "010-9481-9943",
  office: "02-961-1895",
  address: "서울시 동대문구 회기로 37",
  website: "https://www.kida.re.kr",
};

function escapeVcard(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function normalizeTel(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function createVcard(card: BusinessCard) {
  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVcard(card.nameKo)}`,
    `N:${escapeVcard(card.familyName)};${escapeVcard(card.givenName)};;;`,
    `ORG:${escapeVcard(card.organization)};${escapeVcard(card.department)}`,
    `TITLE:${escapeVcard(card.title)}`,
    `EMAIL;TYPE=INTERNET:${escapeVcard(card.email)}`,
    `TEL;TYPE=CELL:${normalizeTel(card.mobile)}`,
    `TEL;TYPE=WORK:${normalizeTel(card.office)}`,
    `ADR;TYPE=WORK:;;${escapeVcard(card.address)};;;;`,
    `URL:${escapeVcard(card.website)}`,
    "END:VCARD",
  ].join("\r\n");
}

export function createMeCard(card: BusinessCard) {
  return [
    "MECARD:",
    `N:${card.nameKo};`,
    `ORG:${card.organization};`,
    `TITLE:${card.title};`,
    `TEL:${normalizeTel(card.mobile)};`,
    `TEL:${normalizeTel(card.office)};`,
    `EMAIL:${card.email};`,
    `ADR:${card.address};`,
    `URL:${card.website};`,
    ";",
  ].join("");
}

export function getVcardFileName(card: BusinessCard) {
  return `${card.nameKo}_${card.organization}.vcf`;
}
