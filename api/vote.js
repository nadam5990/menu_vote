const { GoogleSpreadsheet } = require('google-spreadsheet');

// 환경 변수 검증 (Vercel 설정에서 필수로 넣어야 함)
const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEET_ID } = process.env;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
            return res.status(500).json({ error: '서버 환경 변수가 설정되지 않았습니다.' });
        }

        // 인증 및 시트 초기화
        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID);
        // Vercel의 환경 변수 입력 특성 상 줄바꿈 문자가 escaped 되어 있을 수 있으므로 치환해줌
        const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

        await doc.useServiceAccountAuth({
            client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: privateKey,
        });
        await doc.loadInfo();
        
        // 첫 번째 시트를 사용한다고 가정 (Index 0)
        const sheet = doc.sheetsByIndex[0];

        // ----------------------------------------------------
        // GET 요청: 현재 전체 투표 현황을 읽어서 반환
        // ----------------------------------------------------
        if (req.method === 'GET') {
            const rows = await sheet.getRows();
            
            const votes = {
                bibimbap: 0,
                donkatsu: 0,
                gukbap: 0,
                salad: 0
            };

            // B열 데이터 (메뉴명) 확인 (시트의 컬럼명에 따라 "메뉴" 로 가정)
            rows.forEach(row => {
               // 1열(A): 타임스탬프, 2열(B): 메뉴 라고 가정
               // 최신 google-spreadsheet 패키지는 헤더명 기반 `row.get('헤더명')` 사용을 권장하지만
               // 범용성을 위해 row._rawData 로 접근하거나 _rawData가 없으면 다른 방식 (보통 row.메뉴)
               
               // 구글폼 연동 시트라면 "선택한 메뉴" 또는 "메뉴" 등의 헤더를 가질 확률이 높음
               // 시트를 직접 만든다면 "메뉴" 라고 헤더를 지정
               const menuValue = (row.get('메뉴') || row.get('선택한 메뉴') || (row._rawData ? row._rawData[1] : null))?.toString().trim();
               
               if (menuValue === '비빔밥') votes.bibimbap++;
               else if (menuValue === '돈까스') votes.donkatsu++;
               else if (menuValue === '국밥') votes.gukbap++;
               else if (menuValue === '샐러드') votes.salad++;
            });

            return res.status(200).json(votes);
        }

        // ----------------------------------------------------
        // POST 요청: 새로운 투표 추가 또는 변경
        // 바디 포맷 예시: { "action": "vote", "menu": "비빔밥" }
        // ----------------------------------------------------
        if (req.method === 'POST') {
            const { action, menu } = req.body;

            if (action === 'vote' && menu) {
                // 새로운 행 추가 (타임스탬프, 메뉴)
                // 만약 취소 기능을 구현하려면 시트에 고유 ID를 부여해야 하나, 
                // 가장 간단한 방법은 취소 시 '취소' 행을 추가하거나 기존 행을 찾아 지우는 것.
                // 편의상 행 추가만 구현 (구글 폼 방식과 유사)
                await sheet.addRow({
                    '타임스탬프': new Date().toISOString(),
                    '메뉴': menu
                });
                return res.status(200).json({ success: true, message: '투표가 기록되었습니다.' });
            } 
            else if (action === 'cancel' && menu) {
                // 이전 투표 취소 요청 (가장 마지막에 해당 메뉴를 투표한 행을 찾아 지우는 로직)
                const rows = await sheet.getRows();
                
                // 뒤에서부터 탐색하여 하나 삭제
                for (let i = rows.length - 1; i >= 0; i--) {
                    const rowMenu = (rows[i].get('메뉴') || rows[i].get('선택한 메뉴') || (rows[i]._rawData ? rows[i]._rawData[1] : null))?.toString().trim();
                    if (rowMenu === menu) {
                        await rows[i].delete();
                        return res.status(200).json({ success: true, message: '투표가 취소되었습니다.' });
                    }
                }
                return res.status(404).json({ success: false, message: '취소할 투표 내역을 찾지 못했습니다.' });
            }

            return res.status(400).json({ error: '잘못된 액션입니다.' });
        }

        return res.status(405).json({ error: 'Method Not Allowed' });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: '내부 서버 오류', details: error.message });
    }
}
