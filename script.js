document.addEventListener('DOMContentLoaded', () => {
    // 1. 초기 득표 수 상태
    const votes = {
        bibimbap: Math.floor(Math.random() * 10) + 5,
        donkatsu: Math.floor(Math.random() * 10) + 12,
        gukbap: Math.floor(Math.random() * 10) + 10,
        salad: Math.floor(Math.random() * 10) + 4
    };

    let totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    let selectedMenu = null;
    let userHasVoted = false;
    let lastVotedMenu = null; // 투표했던 메뉴 기록

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
    voteBtn.addEventListener('click', () => {
        if (!selectedMenu || userHasVoted) return;

        // 투표 수 가산
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
        switch(key) {
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

    // 5. 실시간 투표 시뮬레이션 (렌더 가속)
    setInterval(() => {
        const menuKeys = Object.keys(votes);
        const randomMenu = menuKeys[Math.floor(Math.random() * menuKeys.length)];
        
        // 50% 확률로 무작위 투표 유입 발생
        if (Math.random() > 0.5) {
            votes[randomMenu]++;
            totalVotes++;
            updateCharts();
        }
    }, 2000);

    // Initial draw
    updateCharts();
});
