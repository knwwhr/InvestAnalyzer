// API 설정
// Vercel 배포 후 이 URL을 변경하세요
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001/api'  // 로컬 개발
  : 'https://investar-s7l7.vercel.app/api';  // Vercel 배포 완료

export { API_BASE_URL };
