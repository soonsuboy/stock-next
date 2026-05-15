export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">
          투자지표 분석 플랫폼
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
          한국·미국 상장사의 PER, PBR, ROE 지표를 분석하고, 시계열 데이터를 통해
          <br />
          기업의 투자 가치를 한눈에 파악하세요.
        </p>

        {/* Quick Links */}
        <div className="flex gap-4 justify-center flex-wrap mb-16">
          <a
            href="/search"
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            🔍 종목 검색
          </a>
          <a
            href="/watchlist"
            className="px-8 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-semibold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
          >
            ⭐ 관심 종목
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-8 py-12">
        <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-lg transition">
          <div className="text-4xl mb-3">🔎</div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            종목 검색
          </h3>
            <p className="text-slate-600 dark:text-slate-400">
            DB에 적재된 한국·미국 상장사를 키워드로 검색하고 관심 목록에 추가하세요.
          </p>
        </div>

        <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-lg transition">
          <div className="text-4xl mb-3">💾</div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            자동 수집
          </h3>
            <p className="text-slate-600 dark:text-slate-400">
            GitHub Actions 배치가 재무제표와 지표를 주기적으로 수집 및 저장합니다.
          </p>
        </div>

        <div className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-lg transition">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
            시각화 분석
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            ROE, PBR, PER 지표를 삼각형 차트로 직관적으로 분석하세요.
          </p>
        </div>
      </section>

      {/* Data Sources */}
      <section className="bg-slate-50 dark:bg-slate-800 rounded-lg p-8 mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
          데이터 출처
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              🇰🇷 한국 종목
            </h3>
            <ul className="text-slate-600 dark:text-slate-400 space-y-1">
              <li>• 종목 정보: DART corpCode / DB 배치</li>
              <li>• 재무제표: 금융감독원 DART</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
              🇺🇸 미국 종목
            </h3>
            <ul className="text-slate-600 dark:text-slate-400 space-y-1">
              <li>• 종목 정보: NASDAQ Trader / SEC ticker map</li>
              <li>• 재무제표: SEC XBRL companyfacts</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
