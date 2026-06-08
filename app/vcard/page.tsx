import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ExchangeForm from "@/app/vcard/ExchangeForm";
import { kidaCard } from "@/lib/vcard";

export const metadata: Metadata = {
  title: "서대웅 명함 - 한국국방연구원",
  description: "서대웅 선임연구원 디지털 명함과 연락처 저장 QR",
};

const contacts = [
  { label: "Email", value: kidaCard.email, href: `mailto:${kidaCard.email}` },
  { label: "Mobile", value: kidaCard.mobile, href: `tel:${kidaCard.mobile.replace(/[^\d+]/g, "")}` },
  { label: "Office", value: kidaCard.office, href: `tel:${kidaCard.office.replace(/[^\d+]/g, "")}` },
  { label: "Address", value: kidaCard.address, href: null },
];

export default function VcardPage() {
  return (
    <div className="bg-[#f5f2eb] text-[#1a1a2e]">
      <section className="mx-auto grid min-h-[calc(100vh-9rem)] w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(340px,460px)_1fr] lg:px-6">
        <div className="self-start overflow-hidden border border-[#d4cfc4] bg-white shadow-[0_22px_70px_rgba(15,31,61,0.14)]">
          <div className="relative overflow-hidden bg-[#0f1f3d] px-8 py-9 text-white">
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full border border-[#c4972a]/25" />
            <div className="absolute -right-4 top-2 h-24 w-24 rounded-full border border-[#c4972a]/20" />
            <p className="relative mb-7 text-sm font-semibold text-white/85">KIDA 한국국방연구원</p>
            <div className="relative mb-5 h-0.5 w-9 bg-[#c4972a]" />
            <p className="relative mb-2 font-serif text-xs uppercase tracking-[0.24em] text-[#e8be5a]">
              {kidaCard.nameEn}
            </p>
            <h1 className="relative font-serif text-4xl font-semibold tracking-[0.12em]">
              서 대 웅
            </h1>
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              <span className="bg-[#c4972a] px-3 py-1 text-xs font-semibold text-[#0f1f3d]">
                {kidaCard.title}
              </span>
              <span className="text-xs text-white/65">{kidaCard.department}</span>
            </div>
          </div>

          <div className="divide-y divide-[#eeece7] px-8 py-7">
            {contacts.map((item) => (
              <div className="grid grid-cols-[36px_1fr] gap-4 py-3" key={item.label}>
                <div className="grid h-9 w-9 place-items-center rounded-md bg-[#0f1f3d] text-sm font-bold text-[#e8be5a]">
                  {item.label.slice(0, 1)}
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#c4972a]">
                    {item.label}
                  </p>
                  {item.href ? (
                    <a className="text-sm text-[#1a1a2e] hover:underline" href={item.href}>
                      {item.value}
                    </a>
                  ) : (
                    <p className="text-sm">{item.value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 border-t border-[#d4cfc4] bg-[#faf9f6] px-8 py-6 sm:grid-cols-2">
            <Link
              className="grid h-11 place-items-center rounded-md bg-[#0f1f3d] px-4 text-sm font-semibold text-white transition hover:bg-[#243b65]"
              href={`/api/vcard/contact/${kidaCard.slug}.vcf?platform=web`}
            >
              연락처 파일 저장
            </Link>
            <a
              className="grid h-11 place-items-center rounded-md border border-[#0f1f3d] px-4 text-sm font-semibold text-[#0f1f3d] transition hover:bg-[#0f1f3d] hover:text-white"
              href={`mailto:${kidaCard.email}`}
            >
              이메일 보내기
            </a>
          </div>
        </div>

        <div className="grid content-start gap-6">
          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-[#c4972a]">
              Contact Exchange
            </p>
            <h2 className="max-w-2xl text-3xl font-black leading-tight text-[#0f1f3d] sm:text-5xl">
              QR을 찍으면 바로 연락처로 저장되는 디지털 명함
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-[#d4cfc4] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[#0f1f3d]">iPhone QR</h3>
                  <p className="mt-1 text-sm text-slate-600">iOS 연락처 파일로 연결됩니다.</p>
                </div>
                <span className="rounded-md bg-[#0f1f3d] px-3 py-1 text-xs font-bold text-white">
                  .VCF
                </span>
              </div>
              <Image
                alt="iPhone 연락처 저장 QR"
                className="mx-auto h-56 w-56 rounded-md border border-slate-200 bg-white p-3"
                height={224}
                src="/api/vcard/qr?platform=ios"
                unoptimized
                width={224}
              />
            </div>

            <div className="border border-[#d4cfc4] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-[#1a4d45]">Android QR</h3>
                  <p className="mt-1 text-sm text-slate-600">연락처 인식용 MECARD 형식입니다.</p>
                </div>
                <span className="rounded-md bg-[#1a4d45] px-3 py-1 text-xs font-bold text-white">
                  MECARD
                </span>
              </div>
              <Image
                alt="Android 연락처 저장 QR"
                className="mx-auto h-56 w-56 rounded-md border border-slate-200 bg-white p-3"
                height={224}
                src="/api/vcard/qr?platform=android"
                unoptimized
                width={224}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <div className="border border-[#d4cfc4] bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-lg font-black text-[#0f1f3d]">상대방 명함 받기</h3>
              <ExchangeForm />
            </div>

            <div className="border border-[#d4cfc4] bg-[#0f1f3d] p-5 text-white shadow-sm">
              <h3 className="mb-3 text-lg font-black">저장되는 데이터</h3>
              <div className="grid gap-3 text-sm text-white/78">
                <p>iPhone용 연락처 파일 다운로드는 스캔 이벤트로 기록됩니다.</p>
                <p>교환 폼으로 받은 이름, 회사, 직함, 이메일, 휴대폰, 메모는 Turso DB에 저장됩니다.</p>
                <p>Android QR은 휴대폰 연락처 앱 인식을 우선해 MECARD 값을 직접 담았습니다.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
