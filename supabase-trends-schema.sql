-- 검색 트렌드 데이터 (Google Trends)
CREATE TABLE IF NOT EXISTS search_trends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(100) NOT NULL,

  -- 검색량 데이터
  search_value INTEGER NOT NULL, -- 0-100 상대 검색량
  avg_value NUMERIC(10,2) NOT NULL, -- 7일 평균
  change_rate NUMERIC(10,2) NOT NULL, -- 평균 대비 변화율

  -- 급증 감지
  surge_detected BOOLEAN DEFAULT false, -- 3배 이상 급증
  surge_score INTEGER DEFAULT 0, -- 급증 점수 (0-100)

  collected_at TIMESTAMP DEFAULT NOW()
);

-- 뉴스 언급 데이터
CREATE TABLE IF NOT EXISTS news_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_code VARCHAR(10),
  stock_name VARCHAR(100) NOT NULL,

  -- 뉴스 정보
  news_title TEXT NOT NULL,
  news_url TEXT,
  news_source VARCHAR(50) NOT NULL, -- '네이버', '다음', etc
  published_at TIMESTAMP NOT NULL,

  -- AI 분석 (선택적)
  sentiment VARCHAR(20), -- positive, neutral, negative
  impact_score INTEGER, -- 0-100
  keywords TEXT[], -- 추출된 키워드
  ai_summary TEXT, -- AI 요약 (나중에 추가)

  collected_at TIMESTAMP DEFAULT NOW()
);

-- 종목별 종합 트렌드 점수 (집계 테이블)
CREATE TABLE IF NOT EXISTS stock_trend_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(100) NOT NULL,

  -- 검색 트렌드
  search_score NUMERIC(5,2) DEFAULT 0, -- 0-40점
  search_surge BOOLEAN DEFAULT false,

  -- 뉴스 트렌드
  news_score NUMERIC(5,2) DEFAULT 0, -- 0-40점
  mentions_24h INTEGER DEFAULT 0,
  mentions_7d INTEGER DEFAULT 0,
  mention_change_rate NUMERIC(10,2) DEFAULT 0,

  -- AI 감성 분석 (선택적)
  sentiment_score NUMERIC(5,2) DEFAULT 0, -- 0-20점
  positive_ratio NUMERIC(5,2) DEFAULT 0,

  -- 종합 트렌드 점수
  total_trend_score NUMERIC(5,2) DEFAULT 0, -- 0-100점
  is_hot_issue BOOLEAN DEFAULT false, -- 70점 이상

  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_search_trends_code ON search_trends(stock_code);
CREATE INDEX IF NOT EXISTS idx_search_trends_date ON search_trends(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_trends_surge ON search_trends(surge_detected) WHERE surge_detected = true;

-- 일일 1회만 수집 (UNIQUE INDEX로 구현)
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_trends_daily
  ON search_trends(stock_code, DATE(collected_at));

CREATE INDEX IF NOT EXISTS idx_news_stock ON news_mentions(stock_code);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_mentions(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_mentions(news_source);

CREATE INDEX IF NOT EXISTS idx_trend_scores_code ON stock_trend_scores(stock_code);
CREATE INDEX IF NOT EXISTS idx_trend_scores_hot ON stock_trend_scores(is_hot_issue) WHERE is_hot_issue = true;
CREATE INDEX IF NOT EXISTS idx_trend_scores_score ON stock_trend_scores(total_trend_score DESC);

-- 일일 1회만 집계 (UNIQUE INDEX로 구현)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trend_scores_daily
  ON stock_trend_scores(stock_code, DATE(updated_at));

-- RLS 활성화
ALTER TABLE search_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_trend_scores ENABLE ROW LEVEL SECURITY;

-- 읽기 권한 (모두)
CREATE POLICY "Public can read search trends" ON search_trends
  FOR SELECT USING (true);

CREATE POLICY "Public can read news mentions" ON news_mentions
  FOR SELECT USING (true);

CREATE POLICY "Public can read trend scores" ON stock_trend_scores
  FOR SELECT USING (true);

-- 쓰기 권한 (서버만)
CREATE POLICY "Service can insert search trends" ON search_trends
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can insert news mentions" ON news_mentions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can upsert trend scores" ON stock_trend_scores
  FOR ALL USING (true) WITH CHECK (true);

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_trend_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_trend_scores_timestamp
  BEFORE UPDATE ON stock_trend_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_trend_scores_updated_at();

-- 통계 뷰: HOT 이슈 종목 (실시간)
CREATE OR REPLACE VIEW hot_issue_stocks AS
SELECT
  s.stock_code,
  s.stock_name,
  s.total_trend_score,
  s.search_score,
  s.news_score,
  s.sentiment_score,
  s.mentions_24h,
  s.mention_change_rate,

  -- 검색 트렌드 상세
  t.search_value as current_search_value,
  t.change_rate as search_change_rate,
  t.surge_detected,

  s.updated_at

FROM stock_trend_scores s
LEFT JOIN LATERAL (
  SELECT search_value, change_rate, surge_detected
  FROM search_trends
  WHERE stock_code = s.stock_code
  ORDER BY collected_at DESC
  LIMIT 1
) t ON true

WHERE s.is_hot_issue = true
ORDER BY s.total_trend_score DESC, s.updated_at DESC;

-- 통계 뷰: 검색량 급증 종목
CREATE OR REPLACE VIEW search_surge_stocks AS
SELECT
  stock_code,
  stock_name,
  search_value as current_value,
  avg_value,
  change_rate,
  surge_score,
  collected_at
FROM search_trends
WHERE surge_detected = true
  AND DATE(collected_at) = CURRENT_DATE
ORDER BY surge_score DESC, change_rate DESC;

COMMENT ON TABLE search_trends IS 'Google Trends 검색량 데이터';
COMMENT ON TABLE news_mentions IS '뉴스 언급 기록';
COMMENT ON TABLE stock_trend_scores IS '종목별 종합 트렌드 점수';
COMMENT ON VIEW hot_issue_stocks IS 'HOT 이슈 종목 (트렌드 점수 70점 이상)';
COMMENT ON VIEW search_surge_stocks IS '검색량 급증 종목 (오늘)';
