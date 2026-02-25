document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const searchInput = document.getElementById('medicine-search');
    const medicineList = document.getElementById('medicine-list');
    const selectedList = document.getElementById('selected-medicines');
    const resultsBody = document.getElementById('results-body');
    const warningsArea = document.getElementById('warnings-area');
    const safetyStatus = document.getElementById('safety-status');
    const clearBtn = document.getElementById('clear-all');

    // Data - Loaded from data/kampo_data.js
    const medicines = typeof kampoData !== 'undefined' ? kampoData : (window.kampoData || []);

    let selectedMedicines = [];
    let currentFilteredMedicines = medicines; // To track currently visible items for Enter key

    // Helper: Hiragana to Katakana
    function hiraToKata(str) {
        return str.replace(/[\u3041-\u3096]/g, function (match) {
            var chr = match.charCodeAt(0) + 0x60;
            return String.fromCharCode(chr);
        });
    }

    // Initial Render
    renderMedicineList(medicines);
    initMobileToggle();

    // モバイル用トグル制御
    function initMobileToggle() {
        const toggleBtn = document.getElementById('toggle-search');
        const selectionPanel = document.querySelector('.selection-panel');
        if (!toggleBtn || !selectionPanel) return;

        // パネル内に閉じるボタンを動的に追加（モバイル時のみ有効）
        const closeBtn = document.createElement('button');
        closeBtn.className = 'mobile-close-btn mobile-only';
        closeBtn.innerHTML = '✕';
        closeBtn.addEventListener('click', () => {
            selectionPanel.classList.remove('is-open');
            document.body.style.overflow = ''; // スクロール復帰
        });
        selectionPanel.appendChild(closeBtn);

        toggleBtn.addEventListener('click', () => {
            selectionPanel.classList.add('is-open');
            document.body.style.overflow = 'hidden'; // 背後のスクロールを止める
            searchInput.focus();
        });
    }

    function renderMedicineList(items) {
        currentFilteredMedicines = items;
        medicineList.innerHTML = '';
        if (items.length === 0) {
            medicineList.innerHTML = '<div class="empty-state">該当する漢方薬がありません</div>';
            return;
        }

        items.forEach(med => {
            const div = document.createElement('div');
            div.className = 'medicine-item';

            // 生薬リストを最大3つまでタグ表示、それ以上は「ほか」
            const drugs = Object.keys(med.crude_drugs);
            const tagsToShow = drugs.slice(0, 3);
            const hasMore = drugs.length > 3;

            let tagsHtml = '<div class="crude-drug-tags-container">';
            tagsToShow.forEach(drug => {
                tagsHtml += `<span class="crude-drug-tag">${drug}</span>`;
            });
            if (hasMore) {
                tagsHtml += `<span class="crude-drug-tag" style="background:#f0f0f0; border-color:transparent;">+${drugs.length - 3}</span>`;
            }
            tagsHtml += '</div>';

            div.innerHTML = `
                <div style="flex: 1;">
                    <strong>No.${med.number} ${med.name}</strong>
                    ${tagsHtml}
                </div>
                <button class="add-btn">+</button>
            `;
            div.addEventListener('click', () => selectMedicine(med));
            medicineList.appendChild(div);
        });
    }

    // 検索クリアボタンの制御
    const clearSearchBtn = document.getElementById('clear-search');
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        renderMedicineList(medicines);
        searchInput.focus();
    });

    // Search Logic (Kanji/Hiragana/Katakana/Number)
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        if (!term) {
            renderMedicineList(medicines);
            return;
        }

        // Allow shorthand number search, e.g. "1" matches "001" or "1"
        const isNumeric = /^\d+$/.test(term);
        const paddedTerm = isNumeric ? term.padStart(3, '0') : term;
        const normalizedTerm = hiraToKata(term);

        const filtered = medicines.filter(med => {
            if (isNumeric && (med.number === paddedTerm || med.number.includes(term))) return true;
            if (med.name.includes(term)) return true;
            if (med.name.includes(normalizedTerm)) return true;
            return false;
        });

        // クリアボタンの表示切り替え
        clearSearchBtn.style.display = term ? 'flex' : 'none';

        renderMedicineList(filtered);
    });

    // Quick Add on Enter Key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFilteredMedicines.length > 0) {
                selectMedicine(currentFilteredMedicines[0]);
                // Clear search box after add for faster continuous input
                searchInput.value = '';
                clearSearchBtn.style.display = 'none';
                renderMedicineList(medicines);
                searchInput.focus();
            }
        }
    });

    // Select Medicine
    function selectMedicine(med) {
        if (selectedMedicines.some(item => item.id === med.id)) {
            alert('この薬剤は既に選択されています。');
            return;
        }
        // 初期値は標準1日量（g）を設定
        selectedMedicines.push({ ...med, current_g: med.daily_dose_g });
        renderSelectedMedicines();
        calculateResults();

        // モバイル版なら追加後にパネルを自動で閉じる
        const selectionPanel = document.querySelector('.selection-panel');
        if (window.innerWidth <= 768 && selectionPanel.classList.contains('is-open')) {
            selectionPanel.classList.remove('is-open');
            document.body.style.overflow = '';
        }
    }

    // Remove Medicine
    function removeMedicine(index) {
        selectedMedicines.splice(index, 1);
        renderSelectedMedicines();
        calculateResults();
    }

    // Clear All
    clearBtn.addEventListener('click', () => {
        selectedMedicines = [];
        renderSelectedMedicines();
        calculateResults();
    });

    // Render Selected List
    function renderSelectedMedicines() {
        selectedList.innerHTML = '';
        if (selectedMedicines.length === 0) {
            selectedList.innerHTML = `
                <div class="placeholder-empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.15" style="margin-bottom: 10px;">
                        <path d="M12 22C12 22 20 18 20 12C20 6.47715 15.5228 2 12 2C8.47715 2 4 6.47715 4 12C4 18 12 22 12 22Z" fill="#2E7D32"/>
                    </svg><br>
                    左のリストから漢方薬を追加してください
                </div>
            `;
            return;
        }

        selectedMedicines.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'selected-item';

            // 1包あたりの重量を推測（通常3包分なので 1日量/3）
            const weightPerPacket = item.daily_dose_g / 3;
            // 現在の入力g数が何包相当かを表示（参考値）
            const packetEquivalent = (item.current_g / weightPerPacket).toFixed(2);

            div.innerHTML = `
                <div class="item-info">
                    <span class="item-name">No.${item.number} ${item.name}</span>
                    <span class="item-details">標準1日量: ${item.daily_dose_g}g</span>
                </div>
                <div class="item-controls" style="flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px;">
                    <div style="font-size: 0.85rem; color: #666;">
                        計算用量: 
                        <input type="number" class="dosage-g-input" data-index="${index}" value="${item.current_g}" step="0.1" min="0" style="width: 70px; padding: 4px; border: 1px solid var(--border-color); border-radius: 4px; font-weight: bold; text-align: right;"> g
                    </div>
                    <div style="font-size: 0.75rem; color: #888; background: #f0f0f0; padding: 2px 6px; border-radius: 4px;">
                        約 ${packetEquivalent} 包分
                    </div>
                    <button class="remove-btn" data-index="${index}">✖</button>
                </div>
            `;
            selectedList.appendChild(div);
        });

        // Event Listeners for dosage changes
        document.querySelectorAll('.dosage-g-input').forEach(el => {
            el.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index);
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= 0) {
                    selectedMedicines[idx].current_g = val;
                    // 包相当数の表示のみリアルタイム更新（再レンダリングせず要素を直接操作）
                    const weightPerPacket = selectedMedicines[idx].daily_dose_g / 3;
                    const packetEquivalent = (val / weightPerPacket).toFixed(2);
                    const label = e.target.parentElement.nextElementSibling;
                    if (label) label.textContent = `約 ${packetEquivalent} 包分`;

                    calculateResults();
                }
            });
        });

        document.querySelectorAll('.remove-btn').forEach(el => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                removeMedicine(idx);
            });
        });
    }

    // Calculate & Render Results
    function calculateResults() {
        const totalCrudeDrugs = {};
        const importantDrugs = ['カンゾウ', 'マオウ', 'ブシ', 'ブシ末', 'ダイオウ', 'オウゴン'];

        selectedMedicines.forEach(item => {
            // 比率 = (現在の入力g数 / 標準の1日g数)
            const ratio = item.current_g / item.daily_dose_g;
            for (const [drugName, amount] of Object.entries(item.crude_drugs)) {
                if (!totalCrudeDrugs[drugName]) {
                    totalCrudeDrugs[drugName] = 0;
                }
                totalCrudeDrugs[drugName] += amount * ratio;
            }
        });

        resultsBody.innerHTML = '';
        const sortedKeys = Object.keys(totalCrudeDrugs).sort((a, b) => {
            const isImportantA = importantDrugs.some(d => a.includes(d));
            const isImportantB = importantDrugs.some(d => b.includes(d));
            if (isImportantA && !isImportantB) return -1;
            if (!isImportantA && isImportantB) return 1;
            return b - a;
        });

        sortedKeys.forEach(drug => {
            const amount = totalCrudeDrugs[drug];
            const tr = document.createElement('tr');

            let displayStatus = '';
            let rowClass = '';
            let amountDisplay = amount.toFixed(2);

            if (drug === 'カンゾウ') {
                if (amount > 2.5) {
                    rowClass = 'highlight-danger-row';
                    displayStatus = '<span style="color:#D32F2F; font-weight:bold;">⚠️ 過量 (2.5g超)</span>';
                    amountDisplay = `<span class="highlight-danger-text">${amount.toFixed(2)}</span>`;
                } else {
                    displayStatus = '<span style="color:#F57C00; font-weight:bold;">注意生薬</span>';
                }
            } else if (drug === 'マオウ' || drug === 'ブシ' || drug === 'ブシ末' || drug === 'ダイオウ' || drug === 'オウゴン') {
                rowClass = 'highlight-warning-row';
                displayStatus = '<span style="color:#F57C00; font-weight:bold;">注意生薬</span>';
            }

            tr.className = rowClass;
            tr.innerHTML = `
                <td>${drug}</td>
                <td>${amountDisplay}</td>
                <td>${displayStatus}</td>
            `;
            resultsBody.appendChild(tr);
        });

        updateWarnings(totalCrudeDrugs);
    }

    function updateWarnings(totals) {
        warningsArea.innerHTML = '';
        let hasWarning = false;
        let hasDanger = false;

        if (totals['カンゾウ'] && totals['カンゾウ'] > 2.5) {
            hasDanger = true;
            const div = document.createElement('div');
            div.className = 'warning-box danger';
            div.innerHTML = `
                <span class="warning-icon">🚨</span>
                <div>
                    <strong>【重大な警告】甘草（カンゾウ）が過量です</strong><br>
                    合計量が2.5gを超過（${totals['カンゾウ'].toFixed(2)}g）。偽アルドステロン症、ミオパチー（低カリウム血症）のリスクが非常に高まっています。<br>
                    <span style="color:#D32F2F; font-weight:bold; font-size: 0.9em;">■ 併用注意：ループ利尿薬・サイアザイド系利尿薬（低カリウム血症の増悪リスク）</span>
                    
                    <div class="evidence-section">
                        <button class="evidence-toggle" onclick="this.nextElementSibling.classList.toggle('open')">
                            ▶ 根拠・エビデンスを確認
                        </button>
                        <div class="evidence-content">
                            医療用漢方製剤等の添付文書に基づき、甘草の1日量が2.5g以上の製剤は「アルドステロン症、ミオパチー、低カリウム血症」のある患者には投与禁忌です。また「重篤副作用疾患別対応マニュアル」にて、1日2.5g（グリチルリチン酸として100mg）付近から偽アルドステロン症の発症リスクが急上昇することが示されています。フロセミドやトリクロルメチアジド等のループ利尿薬・サイアザイド系利尿薬との併用は、相乗的にカリウム排泄を促進させ、致死性不整脈などを引き起こすおそれがあります。<br>
                            <a href="https://www.pmda.go.jp/safety/info-services/drugs/adr-info/manuals-for-hc-pro/0001.html" target="_blank" rel="noopener noreferrer" class="evidence-source">📝 出典：PMDA「重篤副作用疾患別対応マニュアル 偽アルドステロン症」（医療関係者向けポータル）</a>
                        </div>
                    </div>
                </div>
            `;
            warningsArea.appendChild(div);
        }

        if (totals['マオウ']) {
            hasWarning = true;
            const div = document.createElement('div');
            div.className = 'warning-box warning';
            div.innerHTML = `
                <span class="warning-icon">⚠️</span>
                <div>
                     <strong>麻黄（マオウ）が含まれています</strong><br>
                     エフェドリン類による不眠、発汗過多、動悸、血圧上昇等に注意してください。高齢者、心疾患への投与は慎重に。<br>
                     <span style="color:#F57C00; font-weight:bold; font-size: 0.9em;">■ 併用注意：エフェドリン類含有市販薬（総合感冒薬等）、テオフィリン系薬剤</span>
                     
                     <div class="evidence-section">
                        <button class="evidence-toggle" onclick="this.nextElementSibling.classList.toggle('open')">
                            ▶ 根拠・エビデンスを確認
                        </button>
                        <div class="evidence-content">
                            主成分であるエフェドリン類の交感神経刺激作用により、動悸や血圧上昇、不眠などの副作用が知られています。特にプソイドエフェドリン等を含む市販の風邪薬や鼻炎薬との併用、またはテオフィリン製剤（キサンチン系）との併用は、中枢神経刺激作用や交感神経刺激作用を過度に増強させる危険性があるため注意が必要です。また、欧米ではエフェドリン単独の過剰摂取による重篤な心血管系イベントからFDA等で規制の対象となっています。<br>
                            <a href="https://www.pmda.go.jp/PmdaSearch/iyakuSearch/" target="_blank" rel="noopener noreferrer" class="evidence-source">📝 出典：PMDA 医療用医薬品 添付文書情報（「麻黄湯」などで検索）</a>
                        </div>
                    </div>
                </div>
            `;
            warningsArea.appendChild(div);
        }

        if (totals['ダイオウ']) {
            hasWarning = true;
            const div = document.createElement('div');
            div.className = 'warning-box warning';
            div.innerHTML = `
                <span class="warning-icon">⚠️</span>
                <div>
                     <strong>大黄（ダイオウ）が含まれています</strong><br>
                     瀉下作用（下痢）に注意してください。妊産婦および授乳婦への投与は慎重に行うか、避けることが推奨されます。
                     
                     <div class="evidence-section">
                        <button class="evidence-toggle" onclick="this.nextElementSibling.classList.toggle('open')">
                            ▶ 根拠・エビデンスを確認
                        </button>
                        <div class="evidence-content">
                            ダイオウに含まれるアントラキノン誘導体が子宮収縮作用と骨盤内臓器の充血をもたらすため、流産や早産（切迫早産）の危険性があるため「妊婦・産婦には投与しないことが望ましい」とされています。また、母乳への移行により乳児の下痢を引き起こす可能性があるため授乳中も注意が必要です。<br>
                            <a href="https://www.pmda.go.jp/PmdaSearch/iyakuSearch/" target="_blank" rel="noopener noreferrer" class="evidence-source">📝 出典：PMDA 医療用医薬品 添付文書情報（各漢方の禁忌・注意を確認してください）</a>
                        </div>
                    </div>
                </div>
            `;
            warningsArea.appendChild(div);
        }

        if (totals['オウゴン']) {
            hasWarning = true;
            const div = document.createElement('div');
            div.className = 'warning-box warning';
            div.innerHTML = `
                <span class="warning-icon">⚠️</span>
                <div>
                     <strong>黄芩（オウゴン）が含まれています</strong><br>
                     間質性肺炎や肝機能障害の初期症状に注意してください。
                     
                     <div class="evidence-section">
                        <button class="evidence-toggle" onclick="this.nextElementSibling.classList.toggle('open')">
                            ▶ 根拠・エビデンスを確認
                        </button>
                        <div class="evidence-content">
                            オウゴンを含む漢方処方（小柴胡湯など）やその主成分バイカリンは、アレルギー性機序の薬剤性間質性肺炎（乾いた咳、息切れ、発熱等）や肝障害の原因薬物として報告されています。特発性間質性肺炎のガイドライン等でも薬剤性の一因として周知されています。<br>
                            <a href="https://www.pmda.go.jp/safety/info-services/drugs/adr-info/manuals-for-hc-pro/0001.html" target="_blank" rel="noopener noreferrer" class="evidence-source">📝 出典：PMDA「重篤副作用疾患別対応マニュアル 薬剤性肺障害」（医療関係者向けポータル）</a>
                        </div>
                    </div>
                </div>
            `;
            warningsArea.appendChild(div);
        }

        if (hasDanger) {
            safetyStatus.textContent = '警告あり';
            safetyStatus.className = 'status-badge danger';
        } else if (hasWarning) {
            safetyStatus.className = 'status-badge warning';
            safetyStatus.textContent = '注意';
        } else if (Object.keys(totals).length > 0) {
            safetyStatus.className = 'status-badge safe';
            safetyStatus.textContent = '問題なし';
        } else {
            safetyStatus.className = 'status-badge';
            safetyStatus.textContent = '未計算';
        }
    }

    // 印刷機能 (イベントリスナーは1回だけ登録)
    const printBtn = document.getElementById('print-report');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            // 現在の日時をレポートにセット
            const now = new Date();
            const dateStr = now.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const printDateEl = document.getElementById('print-date');
            if (printDateEl) printDateEl.textContent = dateStr;

            // 印刷実行
            window.print();
        });
    }
});
