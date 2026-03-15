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

    // 구글 시트 투표수 동기화 함수
    async function fetchVoteData() {
        try {
            // 변경됨: 기존 구글 시트 URL에서 Vercel API 통신으로 변경
            const response = await fetch('/api/vote');
            if (!response.ok) throw new Error('API 응답에 문제가 있습니다.');
            const data = await response.json();

            // 로컬 투표수 초기화 (서버 응답을 그대로 덮어씀)
            votes.bibimbap = data.bibimbap || 0;
            votes.donkatsu = data.donkatsu || 0;
            votes.gukbap = data.gukbap || 0;
            votes.salad = data.salad || 0;

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
    voteBtn.addEventListener('click', async () => {
        if (!selectedMenu || userHasVoted) return;

        const menuKoreanName = getMenuKoreanName(selectedMenu);

        // 변경됨: /api/vote 백엔드로 투표 기록 전송
        try {
            const response = await fetch('/api/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'vote', menu: menuKoreanName })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '서버 전송 오류');
            }
            console.log('시트에 투표 기록 전송 완료');

            // 로컬 수치 가산 (성공 시에만)
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

        } catch (error) {
            console.error('시트 기록 실패:', error);
            alert('투표 기록 중 에러가 발생했습니다: ' + error.message);
        }
    });

    // 3.1 다시 투표하기 버튼 이벤트
    revoteBtn.addEventListener('click', async () => {
        if (!userHasVoted) return;

        const menuKoreanName = getMenuKoreanName(lastVotedMenu);

        // 이전 투표 차감 (서버로 취소 요청 전송)
        if (lastVotedMenu) {
            try {
                const response = await fetch('/api/vote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'cancel', menu: menuKoreanName })
                });
                if (response.ok) {
                    // 서버에서 취소가 성공한 경우에만 로컬 수치 차감
                    if (votes[lastVotedMenu] > 0) {
                        votes[lastVotedMenu]--;
                        totalVotes--;
                    }
                } else {
                    console.error('취소 요청 실패');
                }
            } catch (error) {
                console.error('취소 요청 중 오류:', error);
            }
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
