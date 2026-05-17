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
  e.preventDefault();
  const f = new FormData(e.target);
  if (Number(f.get("lessonPeriod")) > 4) return;
  state.lessons.push({
    id: uid(),
    name: f.get("lessonName"),
    day: f.get("lessonDay"),
    period: f.get("lessonPeriod"),
    room: String(f.get("lessonRoom") || "").trim()
  });
  save();
  renderTimetable();
  renderTodayLessons();
  document.getElementById("lessonDialog").close();
};

document.getElementById("editLessonForm").onsubmit = (e) => {
  const f = new FormData(e.target);
  const id = f.get("editLessonId");
  const lesson = state.lessons.find(l => l.id === id);
  if (lesson) {
    if (Number(f.get("editLessonPeriod")) > 4) return;
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
  const initialView = window.location.hash.slice(1) || document.querySelector(".view.active")?.id || "home";
  switchView(initialView);
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
