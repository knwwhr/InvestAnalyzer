-- 스크리닝 추천 이력 테이블
CREATE TABLE IF NOT EXISTS screening_recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_date DATE NOT NULL,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(100) NOT NULL,
  recommended_price INTEGER NOT NULL,
  recommendation_grade VARCHAR(10) NOT NULL, -- S, A, B, C
  total_score NUMERIC(5,2) NOT NULL,

  -- 추천 당시 지표
  change_rate NUMERIC(10,2),
  volume BIGINT,
  market_cap BIGINT,

  -- 추천 근거
  whale_detected BOOLEAN DEFAULT false,
  accumulation_detected BOOLEAN DEFAULT false,
  mfi NUMERIC(5,2),
  volume_ratio NUMERIC(10,2),

  -- 추적 정보
  is_active BOOLEAN DEFAULT true,
  closed_at TIMESTAMP,
  closed_price INTEGER,
  close_reason VARCHAR(50), -- 'target_reached', 'stop_loss', 'expired', 'manual'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(recommendation_date, stock_code)
);

-- 일별 가격 추적 테이블 (성과 계산용)
CREATE TABLE IF NOT EXISTS recommendation_daily_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recommendation_id UUID NOT NULL REFERENCES screening_recommendations(id) ON DELETE CASCADE,
  tracking_date DATE NOT NULL,
  closing_price INTEGER NOT NULL,
  change_rate NUMERIC(10,2) NOT NULL,
  volume BIGINT,

  -- 누적 수익률
  cumulative_return NUMERIC(10,2) NOT NULL,
  days_since_recommendation INTEGER NOT NULL,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(recommendation_id, tracking_date)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_recommendations_date ON screening_recommendations(recommendation_date DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_active ON screening_recommendations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recommendations_stock ON screening_recommendations(stock_code);
CREATE INDEX IF NOT EXISTS idx_daily_prices_date ON recommendation_daily_prices(tracking_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_prices_rec ON recommendation_daily_prices(recommendation_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE screening_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_daily_prices ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Public can read recommendations" ON screening_recommendations
  FOR SELECT USING (true);

CREATE POLICY "Public can read daily prices" ON recommendation_daily_prices
  FOR SELECT USING (true);

-- 서버만 쓰기 가능 (API Key 사용)
CREATE POLICY "Service can insert recommendations" ON screening_recommendations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update recommendations" ON screening_recommendations
  FOR UPDATE USING (true);

CREATE POLICY "Service can insert daily prices" ON recommendation_daily_prices
  FOR INSERT WITH CHECK (true);

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recommendations_updated_at
  BEFORE UPDATE ON screening_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 통계 뷰 (성과 분석용)
CREATE OR REPLACE VIEW recommendation_statistics AS
SELECT
  r.recommendation_date,
  r.stock_code,
  r.stock_name,
  r.recommended_price,
  r.recommendation_grade,
  r.total_score,

  -- 최신 가격 (가장 최근 추적 데이터)
  COALESCE(latest.closing_price, r.recommended_price) as current_price,
  COALESCE(latest.cumulative_return, 0) as current_return,
  COALESCE(latest.days_since_recommendation, 0) as days_tracked,

  -- 최대 수익률
  COALESCE(max_prices.max_return, 0) as max_return,
  COALESCE(max_prices.max_price, r.recommended_price) as max_price,

  -- 상태
  r.is_active,
  r.closed_at,
  r.closed_price,

  CASE
    WHEN r.is_active = false AND r.closed_price IS NOT NULL THEN
      ROUND(((r.closed_price - r.recommended_price)::NUMERIC / r.recommended_price * 100), 2)
    ELSE
      COALESCE(latest.cumulative_return, 0)
  END as final_return

FROM screening_recommendations r

LEFT JOIN LATERAL (
  SELECT closing_price, cumulative_return, days_since_recommendation
  FROM recommendation_daily_prices
  WHERE recommendation_id = r.id
  ORDER BY tracking_date DESC
  LIMIT 1
) latest ON true

LEFT JOIN LATERAL (
  SELECT
    MAX(cumulative_return) as max_return,
    MAX(closing_price) as max_price
  FROM recommendation_daily_prices
  WHERE recommendation_id = r.id
) max_prices ON true

ORDER BY r.recommendation_date DESC, r.total_score DESC;

-- 전체 성과 요약 뷰
CREATE OR REPLACE VIEW overall_performance AS
SELECT
  COUNT(*) as total_recommendations,
  COUNT(*) FILTER (WHERE final_return > 0) as winning_count,
  COUNT(*) FILTER (WHERE final_return <= 0) as losing_count,
  ROUND(AVG(final_return), 2) as avg_return,
  ROUND(AVG(final_return) FILTER (WHERE final_return > 0), 2) as avg_winning_return,
  ROUND(AVG(final_return) FILTER (WHERE final_return <= 0), 2) as avg_losing_return,
  ROUND(MAX(final_return), 2) as max_return,
  ROUND(MIN(final_return), 2) as min_return,
  ROUND((COUNT(*) FILTER (WHERE final_return > 0)::NUMERIC / COUNT(*)::NUMERIC * 100), 1) as win_rate
FROM recommendation_statistics;

COMMENT ON TABLE screening_recommendations IS '스크리닝 시스템의 종목 추천 이력';
COMMENT ON TABLE recommendation_daily_prices IS '추천 종목의 일별 가격 추적';
COMMENT ON VIEW recommendation_statistics IS '종목별 성과 통계 (현재 수익률, 최대 수익률 포함)';
COMMENT ON VIEW overall_performance IS '전체 추천 성과 요약 (승률, 평균 수익률 등)';
