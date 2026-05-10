// --- 1. データと初期化[cite: 1] ---
const days = ["月曜日", "火曜日", "水曜日", "木曜日", "金曜日"];
const days_short = ["月", "火", "水", "木", "金"];
const defaultPeriods = [
  { id: 1, start: "09:00", end: "10:30" }, { id: 2, start: "10:40", end: "12:10" },
  { id: 3, start: "13:00", end: "14:30" }, { id: 4, start: "14:40", end: "16:10" },
  { id: 5, start: "16:20", end: "17:50" }, { id: 6, start: "18:00", end: "19:30" },
];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const currentDate = today.getDate();
const currentDayOfWeek = today.getDay(); // 0=日, 1=月, ..., 6=土
const currentDayName = ["日", "月", "火", "水", "木", "金", "土"][currentDayOfWeek];
const currentDayIndex = days_short.indexOf(currentDayName); // days_shortのインデックス

let changeAnalysis = {};

let state = JSON.parse(localStorage.getItem("komapass-state")) || {
  lessons: [],
  periods: structuredClone(defaultPeriods),
  tasks: []
};

const save = () => localStorage.setItem("komapass-state", JSON.stringify(state));
const uid = () => `l-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// --- 2. タブ切り替え ---
function switchView(viewId) {
  console.log("Switching to view:", viewId);
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(viewId);
  console.log("Target element:", target);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item").forEach(n => {
    n.classList.toggle("active", n.getAttribute("data-view") === viewId);
  });

  const titles = { home: "ホーム", timetable: "時間割", changes: "変更追加", tasks: "課題", tests: "テスト", settings: "設定" };
  document.getElementById("viewTitle").textContent = titles[viewId] || "キャンカレ";
}

window.switchView = switchView;

document.querySelectorAll(".nav-item").forEach(n => {
  console.log("Setting up listener for:", n.getAttribute("data-view"));
  n.addEventListener("click", (e) => {
    console.log("Clicked:", n.getAttribute("data-view"));
    switchView(n.getAttribute("data-view"));
  });
});

// --- 3. 描画ロジック ---

// 時間割の描画[cite: 1]
function renderTimetable() {
  const grid = document.querySelector("#timetableGrid");
  if (!grid) return;

  let html = `<div class="tt-cell header"></div>` + days_short.map((d, i) => {
    const dateStr = getDateForDay(i);
    return `<div class="tt-cell header" data-day="${days_short[i]}" ondrop="dropLesson(event)" ondragover="allowDrop(event)">${days_short[i]}<br><small>${dateStr}</small></div>`;
  }).join("");
  state.periods.forEach(p => {
    html += `<div class="tt-cell period"><strong>${p.id}限</strong><br><small>${p.start}</small></div>`;
    days_short.forEach(d => {
      const items = state.lessons.filter(l => l.day === d && Number(l.period) === p.id);
      html += `<div class="tt-cell"><div class="tt-stack">${items.map(l => `
        <div class="lesson-card ${l.status === '休講' ? 'cancelled' : ''}" data-id="${l.id}" draggable="true" ondragstart="dragLesson(event, '${l.id}')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
            <div class="lesson-info" style="flex:1; cursor:pointer;" onclick="editLesson('${l.id}')">
              <strong class="lesson-name">${l.name}</strong>
              ${l.room ? `<span class="lesson-room">${l.room}</span>` : ""}
            </div>
            <button onclick="event.stopPropagation(); deleteLesson('${l.id}');" style="color:#d32f2f; border:none; background:none; font-size:12px; padding:0;">削除</button>
          </div>
        </div>`).join("")}</div></div>`;
    });
  });
  grid.innerHTML = html;
}

function getDateForDay(dayIndex) {
  const diff = dayIndex - currentDayIndex;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + diff);
  return `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;
}

function getDayFromDate(month, date) {
  const targetDate = new Date(2026, month - 1, date);
  const dayOfWeek = targetDate.getDay();
  return ["日", "月", "火", "水", "木", "金", "土"][dayOfWeek];
}
function normalizeDayName(text) {
  if (!text) return null;
  const map = {
    "日曜日": "日", "月曜日": "月", "火曜日": "火", "水曜日": "水", "木曜日": "木", "金曜日": "金", "土曜日": "土"
  };
  if (map[text]) return map[text];
  const match = text.match(/日|月|火|水|木|金|土/);
  return match ? match[0] : null;
}

function parseLessonLine(line) {
  const lesson = { period: null, subject: null, location: null };
  const periodMatch = line.match(/(\d+)限/);
  if (periodMatch) lesson.period = periodMatch[1];

  const locationMatch = line.match(/(?:（場所[:：]\s*(.+?)）|[(（]場所[:：]\s*(.+?)[)）])/);
  if (locationMatch) lesson.location = locationMatch[1] || locationMatch[2];

  // 科目部分を抽出
  let subjectText = line.replace(/.*?\d+限[:：]?\s*/, "");
  if (locationMatch) {
    subjectText = subjectText.replace(locationMatch[0], "").trim();
  }
  lesson.subject = subjectText.replace(/[：:]+$/, "").trim();

  return lesson.period && lesson.subject ? lesson : null;
}

function parseChangeText(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const dateMatch = firstLine.match(/(\d+)月(\d+)日/);
  const dayNameMatch = firstLine.match(/(?:[（(【\[]\s*(日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日|月|火|水|木|金|土)\s*[）)\]】])|(?:\d+月\d+日\s*(日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日|月|火|水|木|金|土))/);
  const month = dateMatch ? dateMatch[1] : null;
  const date = dateMatch ? dateMatch[2] : null;
  const textWithoutDates = rawText.replace(/\d+月\d+日/g, " ");
  const weekdayHints = [...textWithoutDates.matchAll(/(日曜日|月曜日|火曜日|水曜日|木曜日|金曜日|土曜日|日曜|月曜|火曜|水曜|木曜|金曜|土曜|日|月|火|水|木|金|土)/g)]
    .map(match => normalizeDayName(match[1]))
    .filter(Boolean);
  const rawDayName = dayNameMatch ? (dayNameMatch[1] || dayNameMatch[2]) : null;
  let day = rawDayName ? normalizeDayName(rawDayName) : null;
  if (!day && month && date) {
    day = normalizeDayName(getDayFromDate(month, date));
  }
  if (!day && weekdayHints.length > 0) {
    day = weekdayHints[0];
  }

  const lessonLines = lines.slice(1).filter(l => l.match(/\d{1,2}:\d{2}/) && l.match(/\d+限/));
  if (lessonLines.length > 0) {
    const lessons = lessonLines.map(parseLessonLine).filter(Boolean).map(item => ({ ...item, day }));
    if (lessons.length > 0) {
      return { type: "schedule", month, date, day, lessons };
    }
  }

  // 既存の単一行解析ロジック
  const periodMatch = rawText.match(/(\d+)限/);
  const status = rawText.includes("削除") ? "削除" : (rawText.includes("休講") ? "休講" : (rawText.includes("補講") ? "補講" : (rawText.includes("振替") ? "振替" : (rawText.includes("変更") ? "変更" : "通常"))));
  const roomPattern = /(PC-\d+|研究室\d+|[A-Za-z]*\d{1,4}(?:-\d{1,4}){0,3})\s*教室?/;
  const roomMatch = rawText.match(roomPattern);
  let subject = "授業";
  if (periodMatch) {
    const afterPeriod = rawText.slice(rawText.indexOf(periodMatch[0]) + periodMatch[0].length);
    subject = afterPeriod
      .replace(/を.*$/, "")
      .replace(/(休講|補講|振替|変更|教室変更|追加|登録|削除).*/, "")
      .replace(roomPattern, "")
      .trim() || "授業";
  }

  let transferTo = null;
  if (status === "振替") {
    const transferMatch = rawText.match(/振替\s+(.+)$/);
    if (transferMatch) {
      const target = transferMatch[1].trim();
      transferTo = days.find(d => target.includes(d)) || days_short.find(d => target.includes(d));
      if (transferTo && days.includes(transferTo)) {
        transferTo = days_short[days.indexOf(transferTo)];
      }
    }
    if (!transferTo && weekdayHints.length >= 2) {
      transferTo = weekdayHints[weekdayHints.length - 1];
    }
  }

  return { type: "single", month, date, day, period: periodMatch ? periodMatch[1] : null, subject, status, transferTo, room: roomMatch ? roomMatch[1] : "" };
}
// 課題の描画[cite: 1]
function renderTasks() {
  const container = document.querySelector("#taskList");
  const homeContainer = document.querySelector("#homeTasks");
  if (!container) return;

  const sorted = [...state.tasks].sort((a, b) => new Date(a.date) - new Date(b.date));
  const html = sorted.map(t => `
    <div style="background:white; padding:12px; margin-bottom:10px; border-radius:8px; border-left:6px solid #007aff; box-shadow:0 2px 4px rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:flex-start;">
      <div><strong>${t.name}</strong><br><small>📅 ${t.date} ${t.room ? ` | 📍 ${t.room}` : ''} ${t.submission ? ` | 📤 ${t.submission}` : ''}</small></div>
      <div style="display:flex; gap:8px;">
        <button onclick="editTask('${t.id}')" style="color:#007aff; border:none; background:none; font-size:14px;">編集</button>
        <button onclick="deleteTask('${t.id}')" style="color:red; border:none; background:none; font-size:14px;">削除</button>
      </div>
    </div>
  `).join("");

  container.innerHTML = html || "<p>課題無し</p>";
  if (homeContainer) homeContainer.innerHTML = html || "<p>なし</p>";
}

// 今日の授業の描画
function renderTodayLessons() {
  const container = document.getElementById("todayLessons");
  if (!container) return;

  const todayLessons = state.lessons.filter(l => l.day === currentDayName && l.status !== '休講').sort((a, b) => Number(a.period) - Number(b.period));
  const html = todayLessons.map(l => `
    <div style="background:white; padding:12px; margin-bottom:10px; border-radius:8px; border-left:6px solid #34c759; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <div><strong>${l.name}</strong> (${l.period}限)</div>
      ${l.room ? `<div style="margin-top:4px; color: var(--muted); font-size:13px;">教室: ${l.room}</div>` : ""}
    </div>
  `).join("");

  container.innerHTML = html || "<p>今日の授業はありません</p>";
}

// テストの描画
function renderTests() {
  const container = document.querySelector("#testList");
  if (!container) return;

  const sorted = [...state.tasks].filter(t => t.type === "test").sort((a, b) => new Date(a.date) - new Date(b.date));
  const html = sorted.map(t => `
    <div style="background:white; padding:12px; margin-bottom:10px; border-radius:8px; border-left:6px solid #ff3b30; box-shadow:0 2px 4px rgba(0,0,0,0.1); display:flex; justify-content:space-between; align-items:flex-start;">
      <div><strong>${t.name}</strong><br><small>📅 ${t.date} ${t.room ? ` | 📍 ${t.room}` : ''}</small></div>
      <div style="display:flex; gap:8px;">
        <button onclick="editTest('${t.id}')" style="color:#ff3b30; border:none; background:none; font-size:14px;">編集</button>
        <button onclick="deleteTask('${t.id}')" style="color:red; border:none; background:none; font-size:14px;">削除</button>
      </div>
    </div>
  `).join("");

  container.innerHTML = html || "<p>テスト無し</p>";
}

// 削除（ルール：確認なし[cite: 1]）
window.deleteTask = (id) => {
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  renderTasks();
};

function editTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById("editTaskId").value = id;
  document.getElementById("editTaskName").value = task.name;
  document.getElementById("editTaskDate").value = task.date;
  document.getElementById("editTaskRoom").value = task.room;
  document.getElementById("editTaskSubmission").value = task.submission;
  document.getElementById("editTaskDialog").showModal();
}

window.editTask = editTask;

function editTest(id) {
  const test = state.tasks.find(t => t.id === id && t.type === "test");
  if (!test) return;

  document.getElementById("editTestId").value = id;
  document.getElementById("editTestName").value = test.name;
  document.getElementById("editTestDate").value = test.date;
  document.getElementById("editTestRoom").value = test.room;
  document.getElementById("editTestDialog").showModal();
}

window.editTest = editTest;

// 課題追加ボタンと保存[cite: 1]
document.addEventListener("click", (e) => {
  if (e.target.id === "addTaskButton") document.getElementById("taskDialog").showModal();
  if (e.target.id === "cancelTaskButton") document.getElementById("taskDialog").close();
  if (e.target.id === "addTestButton") document.getElementById("testDialog").showModal();
  if (e.target.id === "cancelTestButton") document.getElementById("testDialog").close();
  if (e.target.id === "addLessonButton") document.getElementById("lessonDialog").showModal();
  if (e.target.id === "cancelLessonButton") document.getElementById("lessonDialog").close();
  if (e.target.id === "cancelEditLessonButton") document.getElementById("editLessonDialog").close();
  if (e.target.id === "cancelEditTaskButton") document.getElementById("editTaskDialog").close();
  if (e.target.id === "cancelEditTestButton") document.getElementById("editTestDialog").close();
});

document.getElementById("taskForm").onsubmit = (e) => {
  const f = new FormData(e.target);
  state.tasks.push({ id: uid(), name: f.get("taskName"), date: f.get("taskDate"), room: f.get("taskRoom"), submission: f.get("taskSubmission"), type: "task" });
  save();
  renderTasks();
};

document.getElementById("editTaskForm").onsubmit = (e) => {
  const f = new FormData(e.target);
  const id = f.get("editTaskId");
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.name = f.get("editTaskName");
    task.date = f.get("editTaskDate");
    task.room = f.get("editTaskRoom");
    task.submission = f.get("editTaskSubmission");
    save();
    renderTasks();
  }
  document.getElementById("editTaskDialog").close();
};

document.getElementById("testForm").onsubmit = (e) => {
  const f = new FormData(e.target);
  state.tasks.push({ id: uid(), name: f.get("testName"), date: f.get("testDate"), room: f.get("testRoom"), type: "test" });
  save();
  renderTests();
};

document.getElementById("editTestForm").onsubmit = (e) => {
  const f = new FormData(e.target);
  const id = f.get("editTestId");
  const test = state.tasks.find(t => t.id === id && t.type === "test");
  if (test) {
    test.name = f.get("editTestName");
    test.date = f.get("editTestDate");
    test.room = f.get("editTestRoom");
    save();
    renderTests();
  }
  document.getElementById("editTestDialog").close();
};

document.getElementById("lessonForm").onsubmit = (e) => {
  const f = new FormData(e.target);
  state.lessons.push({ id: uid(), name: f.get("lessonName"), day: f.get("lessonDay"), period: f.get("lessonPeriod"), room: f.get("lessonRoom") });
  save();
  renderTimetable();
  renderTodayLessons();
};

document.getElementById("editLessonForm").onsubmit = (e) => {
  const f = new FormData(e.target);
  const id = f.get("editLessonId");
  const lesson = state.lessons.find(l => l.id === id);
  if (lesson) {
    lesson.name = f.get("editLessonName");
    lesson.day = f.get("editLessonDay");
    lesson.period = f.get("editLessonPeriod");
    lesson.room = f.get("editLessonRoom");
    save();
    renderTimetable();
    renderTodayLessons();
  }
  document.getElementById("editLessonDialog").close();
};

// --- 4. ページ読み込み時の実行 ---
function init() {
  console.log("App initialized");
  // 既存のlessonにstatusを追加
  state.lessons.forEach(l => l.status = l.status || "通常");
  // 土日授業を削除
  state.lessons = state.lessons.filter(l => days_short.includes(l.day));
  renderTimetable();
  renderTasks();
  renderTests();
  renderSettings();
  renderTransferForm();
  renderTodayLessons();
  // トップバーに今日の日付を表示
  document.getElementById("todayDateLabel").textContent = `${currentMonth}/${currentDate} (${currentDayName})`;
}
init();

// --- 設定ビュー ---
function pad(value) {
  return value.toString().padStart(2, "0");
}

function buildTimeOption(value, selectedValue) {
  return `<option value="${pad(value)}"${pad(value) === selectedValue ? " selected" : ""}>${pad(value)}</option>`;
}

function renderSettings() {
  const container = document.getElementById("periodSettings");
  if (!container) return;

  let html = `<h3>時限設定</h3>`;
  state.periods.forEach((p, index) => {
    const [startHour, startMinute] = p.start.split(":");
    const [endHour, endMinute] = p.end.split(":");

    html += `
      <div style="margin-bottom:10px; display:flex; align-items:center; gap:8px;">
        <span>${p.id}限:</span>
        <select id="start-hour-${index}">${Array.from({ length: 24 }, (_, h) => buildTimeOption(h, startHour)).join("")}</select>
        :
        <select id="start-minute-${index}">${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => buildTimeOption(m, startMinute)).join("")}</select>
        〜
        <select id="end-hour-${index}">${Array.from({ length: 24 }, (_, h) => buildTimeOption(h, endHour)).join("")}</select>
        :
        <select id="end-minute-${index}">${[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => buildTimeOption(m, endMinute)).join("")}</select>
      </div>
    `;
  });
  html += `<button class="primary-action" onclick="savePeriods()">保存</button>`;
  container.innerHTML = html;
}

function savePeriods() {
  state.periods.forEach((p, index) => {
    const startHour = document.getElementById(`start-hour-${index}`);
    const startMinute = document.getElementById(`start-minute-${index}`);
    const endHour = document.getElementById(`end-hour-${index}`);
    const endMinute = document.getElementById(`end-minute-${index}`);
    if (startHour && startMinute && endHour && endMinute) {
      p.start = `${startHour.value}:${startMinute.value}`;
      p.end = `${endHour.value}:${endMinute.value}`;
    }
  });
  save();
  renderTimetable();
  alert("時限設定を保存しました。");
}

function renderTransferForm() {
  const sourceDay = document.getElementById("transferSourceDay");
  const targetDay = document.getElementById("transferTargetDay");
  const transferLesson = document.getElementById("transferLesson");
  const status = document.getElementById("transferStatus");
  const transferButton = document.getElementById("transferButton");
  if (!sourceDay || !targetDay || !transferLesson || !status || !transferButton) return;

  sourceDay.innerHTML = days_short.map(d => `<option value="${d}">${d}</option>`).join("");
  targetDay.innerHTML = sourceDay.innerHTML;

  sourceDay.onchange = updateTransferLessonList;
  transferButton.onclick = transferLessonToDay;

  document.querySelectorAll('input[name="changeMode"]').forEach(el => el.onchange = updateChangeMode);
  updateChangeMode();
  updateTransferLessonList();
}

function updateChangeMode() {
  const mode = document.querySelector('input[name="changeMode"]:checked')?.value || "edit";
  const transferFields = document.getElementById("transferFields");
  const applyButton = document.getElementById("applyChangeButton");
  const analyzeButton = document.getElementById("analyzeButton");
  const preview = document.getElementById("changePreview");
  if (!transferFields || !applyButton || !analyzeButton || !preview) return;

  if (mode === "transfer") {
    transferFields.style.display = "block";
    applyButton.style.display = "none";
    analyzeButton.style.display = "none";
    preview.style.display = "none";
  } else {
    transferFields.style.display = "none";
    applyButton.style.display = "inline-flex";
    analyzeButton.style.display = "inline-flex";
    preview.style.display = "block";
  }
}

function updateTransferLessonList() {
  const sourceDay = document.getElementById("transferSourceDay");
  const transferLesson = document.getElementById("transferLesson");
  const status = document.getElementById("transferStatus");
  const transferButton = document.getElementById("transferButton");
  if (!sourceDay || !transferLesson || !status || !transferButton) return;

  const day = sourceDay.value;
  const lessons = state.lessons.filter(l => l.day === day);

  if (lessons.length === 0) {
    transferLesson.innerHTML = `<option value="">該当授業がありません</option>`;
    transferButton.disabled = true;
    status.textContent = `移動元 ${day} に登録された授業がありません。`;
    return;
  }

  transferLesson.innerHTML = lessons.map(l => `<option value="${l.id}">${l.name} (${l.day}${l.period}限)</option>`).join("");
  transferButton.disabled = false;
  status.textContent = `${lessons.length}件の授業が見つかりました。振替先を選択してください。`;
}

function transferLessonToDay() {
  const transferLesson = document.getElementById("transferLesson");
  const targetDay = document.getElementById("transferTargetDay");
  if (!transferLesson || !targetDay) return;

  const lessonId = transferLesson.value;
  const lesson = state.lessons.find(l => l.id === lessonId);
  if (!lesson) {
    alert("振替する授業を選択してください。");
    return;
  }

  const newDay = targetDay.value;
  const conflict = state.lessons.some(l => l.id !== lessonId && l.day === newDay && Number(l.period) === Number(lesson.period));
  if (conflict) {
    if (!confirm("移動先の同じ時限に他の授業が既にあります。上書きしますか？")) {
      return;
    }
  }

  lesson.day = newDay;
  save();
  renderTimetable();
  renderTransferForm();
  alert("授業を振替しました。曜日だけで振替されました。");
}

function editLesson(id) {
  const lesson = state.lessons.find(l => l.id === id);
  if (!lesson) return;

  document.getElementById("editLessonId").value = id;
  document.getElementById("editLessonName").value = lesson.name;
  document.getElementById("editLessonDay").value = lesson.day;
  document.getElementById("editLessonPeriod").value = lesson.period;
  document.getElementById("editLessonRoom").value = lesson.room;
  document.getElementById("editLessonDialog").showModal();
}

window.editLesson = editLesson;

window.deleteLesson = (id) => {
  if (!confirm("この授業を削除しますか？")) return;
  state.lessons = state.lessons.filter(l => l.id !== id);
  save();
  renderTimetable();
  renderTodayLessons();
};

function allowDrop(ev) {
  ev.preventDefault();
}

function dragLesson(ev, id) {
  ev.dataTransfer.setData("text", id);
}

function dropLesson(ev) {
  ev.preventDefault();
  const id = ev.dataTransfer.getData("text");
  const newDay = ev.target.closest('.tt-cell.header').dataset.day;
  const lesson = state.lessons.find(l => l.id === id);
  if (lesson && newDay && lesson.day !== newDay) {
    lesson.day = newDay;
    save();
    renderTimetable();
    renderTodayLessons();
  }
}

// --- 変更情報の解析と反映ロジック ---

// 解析ボタンのイベント登録
const analyzeBtn = document.getElementById("analyzeButton");
if (analyzeBtn) {
  analyzeBtn.onclick = () => {
    const text = document.getElementById("changeText").value;
    const preview = document.getElementById("changePreview");
    const parsed = parseChangeText(text);
    if (!parsed || (!parsed.day && !parsed.month)) {
      preview.innerHTML = "<p style='color:red;'>形式が正しくありません。「月曜」などの曜日、または「○月○日」を含めてください。</p>";
      return;
    }

    if (parsed.type === "schedule") {
      const lessonHtml = parsed.lessons.map(l => `📌 ${parsed.month}/${parsed.date} (${parsed.day}) ${l.period}限 ${l.subject}${l.location ? `（場所：${l.location}）` : ""}`).join("<br>");
      preview.innerHTML = `
        <div style="padding:10px; background:#f0f7f4; border-radius:8px; border:1px solid #9ed8c6;">
          <strong>解析結果: ${parsed.lessons.length}件の授業</strong><br>
          ${lessonHtml}
        </div>
      `;
      changeAnalysis = parsed;
      document.getElementById("applyChangeButton").disabled = false;
      return;
    }

    if (parsed.type === "single" && parsed.period) {
      let resultHtml = `
        <div style="padding:10px; background:#f0f7f4; border-radius:8px; border:1px solid #9ed8c6;">
          <strong>解析結果:</strong><br>
          📅 ${parsed.month && parsed.date ? `${parsed.month}/${parsed.date}` : `${parsed.day}曜`} <br>
          📌 ${parsed.period}限 <br>
          📌 科目: ${parsed.subject} <br>
          📌 状態: ${parsed.status}
      `;
      if (parsed.transferTo) {
        resultHtml += `<br>📌 振替先: ${parsed.transferTo}`;
      }
      if (parsed.room) {
        resultHtml += `<br>📌 教室: ${parsed.room}`;
      }
      resultHtml += `</div>`;
      preview.innerHTML = resultHtml;
      changeAnalysis = parsed;
      document.getElementById("applyChangeButton").disabled = false;
      return;
    }

    preview.innerHTML = "<p style='color:red;'>形式が正しくありません。「月曜 ○限」または「○月○日 ○限」を含めてください。</p>";
  };
}

// 例文ボタンのイベント登録
document.getElementById("exampleTransfer").onclick = () => {
  document.getElementById("changeText").value = "月曜2限を金曜に振替";
};
document.getElementById("exampleSchedule").onclick = () => {
  document.getElementById("changeText").value = "月曜2限 英語A 追加";
};
document.getElementById("exampleCancel").onclick = () => {
  document.getElementById("changeText").value = "月曜2限 英語A 教室変更 302教室";
};
document.getElementById("exampleDelete").onclick = () => {
  document.getElementById("changeText").value = "月曜2限 削除";
};

// 反映ボタンの処理（ルール：予定が被っている時は確認する）
const applyBtn = document.getElementById("applyChangeButton");
if (applyBtn) {
  applyBtn.onclick = () => {
    if (!changeAnalysis.day && !changeAnalysis.month) {
      alert("解析してください。");
      return;
    }
    const day = changeAnalysis.day || getDayFromDate(changeAnalysis.month, changeAnalysis.date);
    const periodId = Number(changeAnalysis.period);

    if (changeAnalysis.type === "schedule") {
      changeAnalysis.lessons.forEach(lesson => {
        state.lessons.push({
          id: uid(),
          name: lesson.subject,
          day: lesson.day || changeAnalysis.day || day,
          period: lesson.period,
          room: lesson.location || "",
          status: "通常"
        });
      });
      alert(`${changeAnalysis.lessons.length}件の授業を追加しました。`);
    } else if (changeAnalysis.status === "休講") {
      // 該当lessonを探してstatus = "休講"
      const lesson = state.lessons.find(l => l.day === day && Number(l.period) === periodId);
      if (lesson) {
        lesson.status = "休講";
      } else {
        // 授業がない場合、追加して休講
        state.lessons.push({ id: uid(), name: changeAnalysis.subject || "休講", day: day, period: changeAnalysis.period, room: "", status: "休講" });
      }
    } else if (changeAnalysis.status === "補講") {
      // 追加
      state.lessons.push({ id: uid(), name: changeAnalysis.subject || "補講", day: day, period: changeAnalysis.period, room: changeAnalysis.room || "", status: "通常" });
    } else if (changeAnalysis.status === "振替") {
      // 該当lessonを探してdayを変更
      const lesson = state.lessons.find(l => l.day === day && Number(l.period) === periodId);
      if (lesson && changeAnalysis.transferTo) {
        lesson.day = changeAnalysis.transferTo;
      } else {
        alert("振替先が指定されていません。");
        return;
      }
    } else if (changeAnalysis.status === "変更") {
      const lesson = state.lessons.find(l => l.day === day && Number(l.period) === periodId);
      if (lesson) {
        if (changeAnalysis.subject && changeAnalysis.subject !== "授業") lesson.name = changeAnalysis.subject;
        if (changeAnalysis.room) lesson.room = changeAnalysis.room;
      } else {
        state.lessons.push({ id: uid(), name: changeAnalysis.subject || "授業", day: day, period: changeAnalysis.period, room: changeAnalysis.room || "", status: "通常" });
      }
    } else if (changeAnalysis.status === "削除") {
      const beforeCount = state.lessons.length;
      state.lessons = state.lessons.filter(l => !(l.day === day && Number(l.period) === periodId));
      if (state.lessons.length === beforeCount) {
        alert("削除する授業が見つかりませんでした。");
        return;
      }
    } else {
