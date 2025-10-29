/**
 * GitHub Gist를 이용한 패턴 영구 저장소
 * Vercel Serverless 환경에서 stateless 문제 해결
 */

const GIST_ID = process.env.GITHUB_GIST_ID || 'YOUR_GIST_ID';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GIST_FILENAME = 'investar-patterns.json';

class GistStorage {
  constructor() {
    this.baseUrl = 'https://api.github.com/gists';
    this.rawUrl = `https://gist.githubusercontent.com/knwwhr/${GIST_ID}/raw/${GIST_FILENAME}`;
  }

  /**
   * GitHub Gist에 패턴 저장
   * @param {Object} patternsData - 저장할 패턴 데이터
   */
  async savePatterns(patternsData) {
    if (!GITHUB_TOKEN) {
      console.log('⚠️ GitHub Token 없음. 로컬에서만 작동합니다.');
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(patternsData, null, 2)
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`GitHub API 오류: ${response.status}`);
      }

      console.log('✅ GitHub Gist에 패턴 저장 완료');
      return true;
    } catch (error) {
      console.error('❌ GitHub Gist 저장 실패:', error.message);
      return false;
    }
  }

  /**
   * GitHub Gist에서 패턴 로드 (Public URL, 인증 불필요)
   */
  async loadPatterns() {
    try {
      // Public Gist는 raw URL로 직접 접근 가능 (인증 불필요)
      const response = await fetch(this.rawUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('⚠️ Gist에 저장된 패턴 없음');
          return null;
        }
        throw new Error(`GitHub API 오류: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ GitHub Gist에서 패턴 로드: ${data.patterns?.length || 0}개`);
      return data;
    } catch (error) {
      console.error('❌ GitHub Gist 로드 실패:', error.message);
      return null;
    }
  }

  /**
   * Gist가 설정되어 있는지 확인
   */
  isConfigured() {
    return GIST_ID !== 'YOUR_GIST_ID';
  }
}

module.exports = new GistStorage();
