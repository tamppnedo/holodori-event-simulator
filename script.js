const S = 15000.0;
const M = 60000.0;
const BASE = 120.0;
const BOOSTS = [1.0, 8.0, 16.0, 24.0, 30.0, 37.0, 42.0, 46.0, 50.0, 53.0, 56.0];
const MUSICS = [1.0, 1.3, 1.2, 1.2, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];

const BOOST_MULTI = [1.0, 6.0, 12.0, 17.0, 22.0, 26.0, 30.0];
const BOOST_COST = [0, 15, 30, 45, 60, 75, 90];
const EVENT_BONUS = [0.0, 20.0, 40.0, 60.0, 80.0, 100.0];

let liveBaseBonus = null;
let revBaseBonus = null;

function getPassMultiplier() {
  return document.getElementById("global_passport").value === "1" ? 2.0 : 1.0;
}

function onPassportChanged() {
  calcLivePt();
  updateRevMinPt();
}

// "分:秒" から 基礎ボーナスを算出
function parseTimeToBaseBonus(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  if (parts.length !== 2) return 0;
  const totalSeconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  if (totalSeconds <= 90) return 0;
  return Math.round((totalSeconds - 90) / 1.9);
}

// "分:秒" から 秒数を算出（シミュレーター連携用）
function getSongSeconds(timeStr) {
  if (!timeStr) return 166;
  const parts = timeStr.split(":");
  if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  return 166;
}

function resolveSongBaseBonus(song) {
  if (typeof song.bonus === "number") {
    return song.bonus;
  }
  return parseTimeToBaseBonus(song.time);
}

function populateSongSelect(searchId, selectId) {
  const songs = (typeof SONG_DATABASE !== "undefined") ? SONG_DATABASE : [];
  const query = document.getElementById(searchId).value.trim().toLowerCase();
  const selectEl = document.getElementById(selectId);

  const filtered = songs.filter(song => song.title.toLowerCase().includes(query));
  selectEl.innerHTML = "";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "-- 未選択 (手入力優先) --";
  selectEl.appendChild(defaultOpt);

  filtered.forEach(song => {
    const baseBonus = resolveSongBaseBonus(song);
    const opt = document.createElement("option");
    opt.value = baseBonus;
    opt.dataset.time = getSongSeconds(song.time);
    const timeLabel = song.time ? `${song.time} / ` : "";
    opt.textContent = `${song.title} (${timeLabel}基礎+${baseBonus}%)`;
    selectEl.appendChild(opt);
  });
}

function filterLiveSongs() {
  populateSongSelect("live_song_search", "live_song_select");
}

function onLiveSongSelected() {
  const selectEl = document.getElementById("live_song_select");
  const selectedOpt = selectEl.options[selectEl.selectedIndex];

  if (selectEl.value === "") {
    liveBaseBonus = null;
  } else {
    liveBaseBonus = parseFloat(selectEl.value);
    const boost = parseInt(document.getElementById("live_boost").value, 10);
    const applied = Math.round(liveBaseBonus * MUSICS[boost]);
    document.getElementById("live_applied_music_input").value = applied;
    
    if (selectedOpt.dataset.time) {
      document.getElementById("sim_song_time").value = selectedOpt.dataset.time;
    }
  }
  calcLivePt();
}

function onLiveBoostChanged() {
  if (liveBaseBonus !== null) {
    const boost = parseInt(document.getElementById("live_boost").value, 10);
    const applied = Math.round(liveBaseBonus * MUSICS[boost]);
    document.getElementById("live_applied_music_input").value = applied;
  }
  calcLivePt();
}

function onLiveAppliedInput() {
  document.getElementById("live_song_select").value = "";
  liveBaseBonus = null;
  calcLivePt();
}

let currentSimInputMode = "sync"; // "sync" または "manual"

function setSimMode(mode) {
  currentSimInputMode = mode;
  const tabSync = document.getElementById("tab_sync");
  const tabManual = document.getElementById("tab_manual");
  const manualFields = document.getElementById("sim_manual_fields");

  if (mode === "sync") {
    tabSync.className = "";
    tabManual.className = "btn-sub";
    manualFields.style.display = "none";
  } else {
    tabSync.className = "btn-sub";
    tabManual.className = "";
    manualFields.style.display = "block";
  }
}

// ---------------- モード4: 周回シミュレーター ----------------
function runSimulation() {
  document.getElementById("mode4_details").open = true;

  const nowPt = parseInt(document.getElementById("sim_now_pt").value, 10) || 0;
  const goalPt = parseInt(document.getElementById("sim_goal_pt").value, 10) || 0;
  const ownedBoost = parseInt(document.getElementById("sim_owned_boost").value, 10) || 0;
  const songSec = parseInt(document.getElementById("sim_song_time").value, 10) || 166;
  const waitSec = parseInt(document.getElementById("sim_wait_time").value, 10) || 75;

  const remaining = goalPt - nowPt;
  const totalTimePerLap = songSec + waitSec;

  if (remaining <= 0) {
    document.getElementById("sim_result_content").innerHTML = 
      '<div class="result-box"><span class="result-val">すでに目標を達成しています。</span></div>';
    return;
  }

  // 0〜10炊きの各Ptを格納する配列
  const ptList = new Array(11).fill(0);

  if (currentSimInputMode === "sync") {
    // 方式A: モード1の設定から厳密計算
    const sScore = parseFloat(document.getElementById("live_sscore").value) || 0;
    const mScore = parseFloat(document.getElementById("live_mscore").value) || 0;
    const bonusVal = parseFloat(document.getElementById("live_bonus").value) || 0;
    const passMult = getPassMultiplier();

    let baseBonusForSim = 0;
    if (liveBaseBonus !== null) {
      baseBonusForSim = liveBaseBonus;
    } else {
      const currentBoost = parseInt(document.getElementById("live_boost").value, 10);
      const manualApplied = parseFloat(document.getElementById("live_applied_music_input").value) || 0;
      baseBonusForSim = manualApplied / MUSICS[currentBoost];
    }

    for (let b = 0; b <= 10; b++) {
      let applied = Math.round(baseBonusForSim * MUSICS[b]);
      ptList[b] = calcLivePtCore(sScore, mScore, b, applied, bonusVal, passMult);
    }
  } else {
    // 方式B: 1周Ptを直接入力して逆算スケーリング
    const manualPt = parseFloat(document.getElementById("sim_manual_pt").value) || 0;
    const manualBoost = parseInt(document.getElementById("sim_manual_boost").value, 10);

    if (manualPt <= 0) {
      document.getElementById("sim_result_content").innerHTML = 
        '<div class="result-box"><span class="error-text">リザルト獲得Ptを正しく入力してください。</span></div>';
      return;
    }

    // 選択された曲長ボーナス基礎（未選択時は0%基準）
    const songBaseBonus = liveBaseBonus !== null ? liveBaseBonus : 0;
    const currentMusicRate = 1.0 + Math.round(songBaseBonus * MUSICS[manualBoost]) / 100.0;
    const baseUnitPt = manualPt / (BOOSTS[manualBoost] * currentMusicRate);

    for (let b = 0; b <= 10; b++) {
      let musicRate = 1.0 + Math.round(songBaseBonus * MUSICS[b]) / 100.0;
      ptList[b] = Math.ceil(baseUnitPt * BOOSTS[b] * musicRate);
    }
  }

  let html = `
    <table class="sim-table">
      <thead>
        <tr>
          <th>炊き</th>
          <th>1周Pt</th>
          <th>周回数</th>
          <th>総必要B</th>
          <th>追加消費石</th>
          <th>実働時間</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (let b = 0; b <= 10; b++) {
    let pt = ptList[b];
    if (pt <= 0) continue;

    let laps = Math.ceil(remaining / pt);
    let totalBoost = laps * b;
    let neededBoost = Math.max(0, totalBoost - ownedBoost);
    let neededStones = neededBoost * 10;
    
    let totalTime = laps * totalTimePerLap;
    let h = Math.floor(totalTime / 3600);
    let m = Math.floor((totalTime % 3600) / 60);
    let s = totalTime % 60;
    
    let timeStr = h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m ${s.toString().padStart(2, '0')}s`;

    html += `
      <tr>
        <td class="center"><strong>${b}</strong></td>
        <td>${pt.toLocaleString()}</td>
        <td>${laps.toLocaleString()}</td>
        <td>${totalBoost.toLocaleString()} B</td>
        <td><strong>${neededStones.toLocaleString()} 個</strong><br><span style="font-size:0.75rem;color:var(--muted);">(不足 ${neededBoost.toLocaleString()}B)</span></td>
        <td class="center">${timeStr}</td>
      </tr>
    `;
  }
  html += `</tbody></table>`;
  document.getElementById("sim_result_content").innerHTML = html;
}

// ---------------- モード2: ソロ目標Pt逆算 ----------------
function filterRevSongs() {
  populateSongSelect("rev_song_search", "rev_song_select");
}

function onRevSongSelected() {
  const selectEl = document.getElementById("rev_song_select");
  if (selectEl.value === "") {
    revBaseBonus = null;
  } else {
    revBaseBonus = parseFloat(selectEl.value);
    const boost = parseInt(document.getElementById("rev_boost").value, 10);
    const applied = Math.round(revBaseBonus * MUSICS[boost]);
    document.getElementById("rev_applied_music_input").value = applied;
  }
  updateRevMinPt();
}

function onRevBoostChanged() {
  if (revBaseBonus !== null) {
    const boost = parseInt(document.getElementById("rev_boost").value, 10);
    const applied = Math.round(revBaseBonus * MUSICS[boost]);
    document.getElementById("rev_applied_music_input").value = applied;
  }
  updateRevMinPt();
}

function onRevAppliedInput() {
  document.getElementById("rev_song_select").value = "";
  revBaseBonus = null;
  updateRevMinPt();
}

function updateRevMinPt() {
  const boost = parseInt(document.getElementById("rev_boost").value, 10);
  const bonusVal = parseFloat(document.getElementById("rev_bonus").value) || 0;
  const appliedMusic = parseFloat(document.getElementById("rev_applied_music_input").value) || 0;
  const passMult = getPassMultiplier();

  const minPt = calcLivePtCore(0, 0, boost, appliedMusic, bonusVal, passMult);
  document.getElementById("rev_min_pt").value = `${minPt.toLocaleString()} Pt`;
}

function calcLivePtCore(sScore, mScore, boost, appliedMusicBonus, bonusVal, passMult) {
  const rawBase = BASE + (sScore / S) + (mScore / M);
  const midVal = Math.ceil(rawBase * (1.0 + bonusVal / 100.0));
  const finalMult = (1.0 + appliedMusicBonus / 100.0) * BOOSTS[boost] * passMult;
  return Math.ceil(midVal * finalMult);
}

function calcLivePt() {
  const boost = parseInt(document.getElementById("live_boost").value, 10);
  const sScore = parseFloat(document.getElementById("live_sscore").value) || 0;
  const mScore = parseFloat(document.getElementById("live_mscore").value) || 0;
  const bonusVal = parseFloat(document.getElementById("live_bonus").value) || 0;
  const appliedMusic = parseFloat(document.getElementById("live_applied_music_input").value) || 0;
  const passMult = getPassMultiplier();

  const pt = calcLivePtCore(sScore, mScore, boost, appliedMusic, bonusVal, passMult);
  document.getElementById("live_result_pt").textContent = pt.toLocaleString() + " Pt";
}

function findTargetScore() {
  const boost = parseInt(document.getElementById("rev_boost").value, 10);
  const targetPt = parseInt(document.getElementById("rev_target_pt").value, 10);
  const bonusVal = parseFloat(document.getElementById("rev_bonus").value) || 0;
  const appliedMusic = parseFloat(document.getElementById("rev_applied_music_input").value) || 0;
  const passMult = getPassMultiplier();

  let minScore = -1;
  let maxScore = -1;

  for (let s = 0; s <= 3500000; s += 250) {
    const earned = calcLivePtCore(s, 0, boost, appliedMusic, bonusVal, passMult);
    if (earned === targetPt) {
      if (minScore === -1) minScore = s;
      maxScore = s;
    }
  }

  const resultEl = document.getElementById("rev_result_score");
  if (minScore !== -1) {
    resultEl.className = "result-val";
    resultEl.textContent = `${minScore.toLocaleString()} 点 〜 ${maxScore.toLocaleString()} 点`;
  } else {
    resultEl.className = "error-text";
    resultEl.textContent = `現在の設定では ${targetPt.toLocaleString()} Pt を出すことは不可能です（飛び石）。倍率（ブースト/特効）を下げるか曲長数値を変更して再試行してください。`;
  }
}

function findSmallestOddPt() {
  const boost = parseInt(document.getElementById("rev_boost").value, 10);
  const bonusVal = parseFloat(document.getElementById("rev_bonus").value) || 0;
  const appliedMusic = parseFloat(document.getElementById("rev_applied_music_input").value) || 0;
  const passMult = getPassMultiplier();

  let foundOddPt = -1;
  let minScore = -1;
  let maxScore = -1;

  for (let s = 0; s <= 3500000; s += 250) {
    const earned = calcLivePtCore(s, 0, boost, appliedMusic, bonusVal, passMult);
    if (earned % 2 !== 0) {
      if (foundOddPt === -1) {
        foundOddPt = earned;
        minScore = s;
        maxScore = s;
      } else if (earned === foundOddPt) {
        maxScore = s;
      } else if (earned !== foundOddPt) {
        break;
      }
    }
  }

  const resultEl = document.getElementById("rev_result_score");
  if (foundOddPt !== -1) {
    document.getElementById("rev_target_pt").value = foundOddPt;
    resultEl.className = "result-val";
    resultEl.textContent = `最小奇数 ${foundOddPt.toLocaleString()} Pt : ${minScore.toLocaleString()} 点 〜 ${maxScore.toLocaleString()} 点`;
  } else {
    resultEl.className = "error-text";
    resultEl.textContent = "現在の設定（ブースト・特効・曲長）ではスコア0〜350万点の範囲に奇数Ptが存在しません。曲またはブースト倍率を変更してください。";
  }
}

function stepOddPt(direction) {
  const boost = parseInt(document.getElementById("rev_boost").value, 10);
  const currentTarget = parseInt(document.getElementById("rev_target_pt").value, 10) || 0;
  const bonusVal = parseFloat(document.getElementById("rev_bonus").value) || 0;
  const appliedMusic = parseFloat(document.getElementById("rev_applied_music_input").value) || 0;
  const passMult = getPassMultiplier();

  const oddMap = new Map();

  for (let s = 0; s <= 3500000; s += 250) {
    const earned = calcLivePtCore(s, 0, boost, appliedMusic, bonusVal, passMult);
    if (earned % 2 !== 0) {
      if (!oddMap.has(earned)) {
        oddMap.set(earned, { minScore: s, maxScore: s });
      } else {
        oddMap.get(earned).maxScore = s;
      }
    }
  }

  const uniqueOdds = Array.from(oddMap.keys()).sort((a, b) => a - b);
  const resultEl = document.getElementById("rev_result_score");

  if (uniqueOdds.length === 0) {
    resultEl.className = "error-text";
    resultEl.textContent = "現在の設定ではスコア0〜350万点の範囲に奇数Ptが存在しません。";
    return;
  }

  let nextOdd = null;

  if (direction > 0) {
    nextOdd = uniqueOdds.find(pt => pt > currentTarget);
    if (nextOdd === undefined) {
      resultEl.className = "error-text";
      resultEl.textContent = `これ以上高い奇数Ptは見つかりません（最大: ${uniqueOdds[uniqueOdds.length - 1].toLocaleString()} Pt）。`;
      return;
    }
  } else {
    const prevOdds = uniqueOdds.filter(pt => pt < currentTarget);
    if (prevOdds.length === 0) {
      resultEl.className = "error-text";
      resultEl.textContent = `これ以上低い奇数Ptは見つかりません（最小: ${uniqueOdds[0].toLocaleString()} Pt）。`;
      return;
    }
    nextOdd = prevOdds[prevOdds.length - 1];
  }

  const data = oddMap.get(nextOdd);
  document.getElementById("rev_target_pt").value = nextOdd;
  resultEl.className = "result-val";
  resultEl.textContent = `${nextOdd.toLocaleString()} Pt : ${data.minScore.toLocaleString()} 点 〜 ${data.maxScore.toLocaleString()} 点`;
}

// ---------------- モード3: ミニゲームDP ----------------
function calcMinigamePtCore(jumps, bIdx, totalBonusPercent, passMult) {
  const basePt = 45 + Math.ceil(jumps * 1.3);
  const midVal = Math.ceil(basePt * (1.0 + totalBonusPercent / 100.0));
  return Math.ceil(midVal * BOOST_MULTI[bIdx] * passMult);
}

function solveMinigameDP() {
  const currentPt = parseInt(document.getElementById("dp_current_pt").value, 10) || 0;
  const finalPt = parseInt(document.getElementById("dp_final_pt").value, 10) || 0;

  const charaBonusIdx = parseInt(document.getElementById("dp_bonus_num").value, 10);
  const charaBonusPercent = EVENT_BONUS[charaBonusIdx];
  const eventBonusPercent = parseFloat(document.getElementById("dp_event_bonus").value) || 0;
  const totalMinigameBonus = charaBonusPercent + eventBonusPercent;

  const maxSafeJumps = parseInt(document.getElementById("dp_max_jumps").value, 10) || 0;
  const passMult = getPassMultiplier();

  const contentEl = document.getElementById("dp_result_content");

  if (currentPt > finalPt) {
    contentEl.innerHTML = '<span class="error-text">エラー: 現在のPtが目標Ptを超えています。</span>';
    return;
  }

  const targetPt = finalPt - currentPt;
  const MAX_TARGET = 100000;

  if (targetPt > MAX_TARGET) {
    contentEl.innerHTML = `<span class="error-text">注意: 差分が ${targetPt.toLocaleString()} Pt あります。DP探索上限（${MAX_TARGET.toLocaleString()} Pt）以下までライブで詰めてください。</span>`;
    return;
  }

  if (targetPt === 0) {
    contentEl.innerHTML = '<span class="result-val">すでに目標Ptに到達しています。</span>';
    return;
  }

  const isPass = document.getElementById("global_passport").value === "1";
  if (isPass && (targetPt % 2 !== 0)) {
    contentEl.innerHTML = `<span class="error-text">エラー: パスポート加入中は縄跳びで偶数Ptしか獲得できません。目標までの差分（${targetPt.toLocaleString()} Pt）が奇数のため着地不可能です。上のライブ逆算（奇数探索）で奇数を拾って偶奇を反転させてください。</span>`;
    return;
  }

  const INF = 99999999;
  const dp = new Int32Array(targetPt + 1).fill(INF);
  const prevPt = new Int32Array(targetPt + 1);
  const moveJump = new Int8Array(targetPt + 1);
  const moveBoost = new Int8Array(targetPt + 1);

  dp[0] = 0;

  for (let c = 0; c < targetPt; c++) {
    if (dp[c] === INF) continue;

    for (let b = 0; b < 7; b++) {
      for (let j = 0; j <= maxSafeJumps; j++) {
        const earned = calcMinigamePtCore(j, b, totalMinigameBonus, passMult);
        const nextPt = c + earned;

        if (nextPt <= targetPt) {
          if (dp[c] + 1 < dp[nextPt]) {
            dp[nextPt] = dp[c] + 1;
            prevPt[nextPt] = c;
            moveJump[nextPt] = j;
            moveBoost[nextPt] = BOOST_COST[b];
          }
        }
      }
    }
  }

  if (dp[targetPt] === INF) {
    contentEl.innerHTML = `<span class="error-text">到達不可: 設定回数（上限 ${maxSafeJumps} 回）の範囲では ${targetPt.toLocaleString()} Pt ピッタリに着地できません。上限回数を増やすか特効枚数を変更してください。</span>`;
    return;
  }

  const steps = [];
  let curr = targetPt;
  while (curr > 0) {
    steps.push({
      boost: moveBoost[curr],
      jump: moveJump[curr]
    });
    curr = prevPt[curr];
  }

  let html = `<div style="font-weight: bold; margin-bottom: 6px;">最短 ${steps.length} 回のプレイで到達可能（目標差分: ${targetPt.toLocaleString()} Pt）</div>`;
  html += '<ol class="step-list">';
  for (let i = steps.length - 1; i >= 0; i--) {
    html += `<li>ブースト <strong>${steps[i].boost}炊き</strong> / <strong>${steps[i].jump} 回</strong> 跳んで終了</li>`;
  }
  html += '</ol>';

  contentEl.innerHTML = html;
}

window.addEventListener("DOMContentLoaded", () => {
  filterLiveSongs();
  filterRevSongs();
  calcLivePt();
  updateRevMinPt();
});
