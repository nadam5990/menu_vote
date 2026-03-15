const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

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

        // Vercel의 환경 변수 입력 특성 상 줄바꿈 문자가 escaped 되어 있을 수 있으므로 치환해줌
        const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

        // 인증 및 시트 초기화 (google-spreadsheet v4 방식)
        const serviceAccountAuth = new JWT({
            email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        
        // 첫 번째 시트를 사용한다고 가정 (Index 0)
        const sheet = doc.sheetsByIndex[0];

        // 빈 시트일 경우 대비 강제로 헤더를 넣어줍니다. 
        // 이렇게 하면 "No values in the header row" 에러를 완벽 차단할 수 있습니다.
        try {
            await sheet.loadHeaderRow();
        } catch (e) {
            await sheet.setHeaderRow(['타임스탬프', '메뉴']);
        }

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
               let menuValue = null;
               const _raw = row._rawData || [];
               try {
                   menuValue = (row.get('메뉴') || row.get('선택한 메뉴'))?.toString().trim();
               } catch (e) {
                   // 헤더 파싱 실패 시 원본 데이터 배열 사용
               }

               if (!menuValue && _raw.length > 0) {
                   // 두 번째 열(index 1)이 있으면 그걸 사용, 1열밖에 없으면 첫번째 열 사용
                   menuValue = _raw.length >= 2 ? _raw[1]?.toString().trim() : _raw[0]?.toString().trim();
               }
               
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
                // 새로운 행 추가 시 Object 대신 Array를 사용하여 헤더 매칭 오류 원천 차단
                await sheet.addRow([new Date().toISOString(), menu]);
                return res.status(200).json({ success: true, message: '투표가 기록되었습니다.' });
            } 
            else if (action === 'cancel' && menu) {
                // 이전 투표 취소 요청 (가장 마지막에 해당 메뉴를 투표한 행을 찾아 지우는 로직)
                const rows = await sheet.getRows();
                
                // 뒤에서부터 탐색하여 하나 삭제
                for (let i = rows.length - 1; i >= 0; i--) {
                    let rowMenu = null;
                    const _raw = rows[i]._rawData || [];
                    try {
                        rowMenu = (rows[i].get('메뉴') || rows[i].get('선택한 메뉴'))?.toString().trim();
                    } catch (e) { }

                    if (!rowMenu && _raw.length > 0) {
                        rowMenu = _raw.length >= 2 ? _raw[1]?.toString().trim() : _raw[0]?.toString().trim();
                    }

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
