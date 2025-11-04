-- news_mentions 테이블에 UPDATE 정책 추가
-- Supabase SQL Editor에서 실행하세요

CREATE POLICY "Service can update news mentions" ON news_mentions
  FOR UPDATE USING (true) WITH CHECK (true);

-- 정책 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'news_mentions'
ORDER BY policyname;
