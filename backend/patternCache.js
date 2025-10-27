/**
 * 패턴 메모리 캐시
 * Vercel Serverless 환경에서는 파일시스템이 읽기 전용이므로
 * 메모리에 패턴을 저장하고 공유
 */

let cachedPatterns = null;
let cacheTimestamp = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24시간

module.exports = {
  /**
   * 패턴 저장
   */
  savePatterns(patternsData) {
    cachedPatterns = patternsData;
    cacheTimestamp = Date.now();
    console.log(`✅ 패턴 캐시 저장: ${patternsData.patterns.length}개`);
  },

  /**
   * 패턴 로드
   */
  loadPatterns() {
    // 캐시가 없거나 만료되었으면 null 반환
    if (!cachedPatterns) {
      return null;
    }

    if (cacheTimestamp && (Date.now() - cacheTimestamp) > CACHE_TTL) {
      console.log('⚠️ 패턴 캐시 만료 (24시간 경과)');
      cachedPatterns = null;
      cacheTimestamp = null;
      return null;
    }

    return cachedPatterns;
  },

  /**
   * 캐시 상태 확인
   */
  getCacheInfo() {
    if (!cachedPatterns) {
      return { cached: false };
    }

    return {
      cached: true,
      patternsCount: cachedPatterns.patterns?.length || 0,
      generatedAt: cachedPatterns.generatedAt,
      cacheAge: cacheTimestamp ? Math.floor((Date.now() - cacheTimestamp) / 1000 / 60) : 0 // 분 단위
    };
  },

  /**
   * 캐시 초기화
   */
  clearCache() {
    cachedPatterns = null;
    cacheTimestamp = null;
    console.log('🗑️ 패턴 캐시 초기화');
  }
};
