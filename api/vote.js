const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

export default async function handler(req, res) {
  // CORS 처리 (Vercel 배포 시 필요)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // OPTIONS 메서드 요청 시 프리플라이트 응답
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST 요청만 처리
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { menu } = req.body;
    
    // 환경 변수 설정 (브라우저 노출 방지)
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    // Vercel 환경 변수의 private key (\\n을 줄바꿈으로 파싱)
    const privateKey = process.env.GOOGLE_PRIVATE_KEY 
        ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
        : '';
    const sheetId = process.env.GOOGLE_SHEET_ID || '1efnYrljVvACPfVrPMS8NlMJS15CLRnikrkKZLnaaUfI'; // 기존 사용 시트 고정 

    if (!clientEmail || !privateKey) {
        return res.status(500).json({ success: false, error: '구글 서비스 계정 환경변수 인증 정보가 없습니다.' });
    }

    // Google API JWT 권한 부여 연결
    const serviceAccountAuth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // 스프레드시트 지정
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    
    // 시트 메타데이터 불러오기
    await doc.loadInfo(); 
    
    // 첫 번째 시트 인덱스 타겟
    const sheet = doc.sheetsByIndex[0]; 
    
    // 행 추가 (헤더 timestamp, menu, voter에 매핑)
    await sheet.addRow({
      timestamp: new Date().toISOString(),
      menu: menu,
      voter: '대시보드_유저' // 기본 처리
    });

    return res.status(200).json({ success: true, message: '서버리스 구글 시트 투표 기록 성공' });
  } catch (error) {
    console.error('시트 기록 중 오류 발생:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
