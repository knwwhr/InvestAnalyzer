-- 뉴스 URL 중복 방지를 위한 UNIQUE 인덱스 추가
-- Supabase SQL Editor에서 실행하세요

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_url_unique ON news_mentions(news_url);

-- 결과 확인
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'news_mentions'
  AND indexname = 'idx_news_url_unique';
