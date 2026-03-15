document.addEventListener('DOMContentLoaded', () => {
    // 1. 초기 득표 수 상태 (시트에서 읽어옴)
    const votes = {
        bibimbap: 0,
        donkatsu: 0,
        gukbap: 0,
        salad: 0
    };

    let totalVotes = 0;
    let selectedMenu = null;
    let userHasVoted = false;
    let lastVotedMenu = null; // 투표했던 메뉴 기록

    const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1efnYrljVvACPfVrPMS8NlMJS15CLRnikrkKZLnaaUfI/gviz/tq?tqx=out:json';

    // 구글 시트 투표수 동기화 함수
    async function fetchVoteData() {
        try {
            const response = await fetch(SHEET_URL);
            const text = await response.text();
            const jsonStr = text.match(/\{.*\}/)[0];
            const data = JSON.parse(jsonStr);
            const rows = data.table.rows;

            // 로컬 투표수 초기화
            votes.bibimbap = 0;
            votes.donkatsu = 0;
            votes.gukbap = 0;
            votes.salad = 0;

            if (rows && rows.length > 0) {
                rows.forEach(row => {
                    if (row.c && row.c[1] && row.c[1].v) {
                        const menuValue = row.c[1].v.toString().trim();
                        if (menuValue === '비빔밥') votes.bibimbap++;
                        else if (menuValue === '돈까스') votes.donkatsu++;
                        else if (menuValue === '국밥') votes.gukbap++;
                        else if (menuValue === '샐러드') votes.salad++;
                    }
                });
            }

            totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
            updateCharts(); // 화면 갱신

        } catch (error) {
            console.error('구글 시트 로딩 실패:', error);
        }
    }

    const cards = document.querySelectorAll('.menu-card');
    const voteBtn = document.getElementById('vote-btn');
    const revoteBtn = document.getElementById('revote-btn'); // 다시 투표하기 버튼
    const chartItems = document.querySelectorAll('.chart-item');
    const winnerBanner = document.getElementById('winner-banner');
    const winnerName = document.getElementById('winner-name');
    const voterCountText = document.getElementById('voter-count');

    // 2. 카드 선택 이벤트
    cards.forEach(card => {
        card.addEventListener('click', () => {
            if (userHasVoted) return; // 이미 투표했다면 선택 변경 금지

            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedMenu = card.getAttribute('data-menu');

            voteBtn.disabled = false;
            voteBtn.innerText = '투표하기';
            voteBtn.style.background = 'var(--primary)';
        });
    });

    // 3. 투표하기 버튼 이벤트
    const GAS_URL = 'https://docs.google.com/spreadsheets/d/1efnYrljVvACPfVrPMS8NlMJS15CLRnikrkKZLnaaUfI/edit?usp=sharing'; // ◀여기에 [웹 앱 URL]을 붙여넣으세요. 구글 시트 공유 주소(docs.google.com/...)는 작동하지 않습니다.

    voteBtn.addEventListener('click', async () => {
        if (!selectedMenu || userHasVoted) return;

        const menuKoreanName = getMenuKoreanName(selectedMenu);

        // 구글 앱스 스크립트로 투표 내역 전송 (GET 방식)
        if (GAS_URL) {
            fetch(`${GAS_URL}?menu=${encodeURIComponent(menuKoreanName)}`)
                .then(response => console.log('시트에 투표 기록 전송 완료'))
                .catch(error => console.error('시트 기록 실패:', error));
        }

        // 로컬 수치 가산 (즉각적인 시각 피드백 유지)
        votes[selectedMenu]++;
        totalVotes++;
        userHasVoted = true;
        lastVotedMenu = selectedMenu;

        // UI 갱신 (선택 방지)
        voteBtn.disabled = true;
        voteBtn.innerText = '투표 완료됨';
        voteBtn.style.background = '#10b981'; // 초록색 완료
        revoteBtn.style.display = 'flex'; // 다시 투표 활성

        cards.forEach(c => c.style.cursor = 'not-allowed');

        // 결과 업데이트
        updateCharts();
        setupVisualFeedback('🎉 투표가 성공적으로 완료되었습니다!');
    });

    // 3.1 다시 투표하기 버튼 이벤트
    revoteBtn.addEventListener('click', () => {
        if (!userHasVoted) return;

        // 이전 투표 차감
        if (lastVotedMenu && votes[lastVotedMenu] > 0) {
            votes[lastVotedMenu]--;
            totalVotes--;
        }

        userHasVoted = false;
        selectedMenu = null;
        lastVotedMenu = null;

        // UI 리셋
        voteBtn.disabled = true;
        voteBtn.innerText = '메뉴를 선택해주세요';
        voteBtn.style.background = 'var(--primary)';
        revoteBtn.style.display = 'none';

        cards.forEach(c => {
            c.classList.remove('selected');
            c.style.cursor = 'pointer';
        });

        updateCharts();
        setupVisualFeedback('🔄 투표가 초기화되어 다시 선택할 수 있습니다.');
    });

    // 4. 차트 업데이트 함수
    function updateCharts() {
        // 최대값 탐색 (1위 노출용)
        let maxVotes = -1;
        let winnerKey = '';

        for (const [key, value] of Object.entries(votes)) {
            if (value > maxVotes) {
                maxVotes = value;
                winnerKey = key;
            }
        }

        // 각 차트 업데이트
        chartItems.forEach(item => {
            const menuKey = item.getAttribute('data-menu');
            const menuVotes = votes[menuKey];
            const percentage = totalVotes > 0 ? Math.round((menuVotes / totalVotes) * 100) : 0;

            const bar = item.querySelector('.chart-bar');
            const percentageText = item.querySelector('.vote-percentage');
            const countText = item.querySelector('.vote-count');

            bar.style.width = `${percentage}%`;
            percentageText.innerText = `${percentage}%`;
            countText.innerText = `(${menuVotes}표)`;
        });

        // 1위 배너 활성화
        if (totalVotes > 0) {
            winnerBanner.style.display = 'flex';
            winnerName.innerText = getMenuKoreanName(winnerKey);
        }

        // 누적 참여자 수 갱신
        voterCountText.innerText = `(사용자 ${totalVotes}명 참여 중)`;
    }

    function getMenuKoreanName(key) {
        switch (key) {
            case 'bibimbap': return '비빔밥';
            case 'donkatsu': return '돈까스';
            case 'gukbap': return '국밥';
            case 'salad': return '샐러드';
            default: return '';
        }
    }

    // 투표 후 시각 피드백 (간단한 알림 등)
    function setupVisualFeedback(message) {
        const body = document.body;
        const feedback = document.createElement('div');
        feedback.innerText = message || '🎉 투표가 성공적으로 완료되었습니다!';
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(139, 92, 246, 0.9);
            color: white;
            padding: 0.8rem 1.5rem;
            border-radius: 50px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease-out, fadeOut 0.3s ease-in 2.5s forwards;
            z-index: 999;
        `;
        body.appendChild(feedback);

        // Remove after duration
        setTimeout(() => feedback.remove(), 2800);
    }

    // 5. 구글 시트 투표수 주기적 동기화 (10초 주기)
    setInterval(fetchVoteData, 10000);

    // 초기 시트 데이터 로드
    fetchVoteData();
});
