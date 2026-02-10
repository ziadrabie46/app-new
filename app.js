const STORAGE_KEY = "task-challenge-state-v1";

const pointsValue = document.getElementById("pointsValue");
const taskForm = document.getElementById("taskForm");
const tasksList = document.getElementById("tasksList");
const taskTemplate = document.getElementById("taskTemplate");

const state = loadState();
render();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { points: 100, tasks: [] };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { points: 100, tasks: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  pointsValue.textContent = state.points;

  if (!state.tasks.length) {
    tasksList.classList.add("empty");
    tasksList.textContent = "لا توجد مهام حالياً.";
    return;
  }

  tasksList.classList.remove("empty");
  tasksList.textContent = "";

  state.tasks.forEach((task) => {
    const node = taskTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".title").textContent = task.title;
    node.querySelector(".time").textContent = `موعد التنفيذ: ${new Date(task.time).toLocaleString("ar-EG")}`;

    const fileInput = node.querySelector(".proof");
    const verifyBtn = node.querySelector(".verify-btn");
    const status = node.querySelector(".status");

    if (task.reviewStatus === "accepted") {
      status.className = "status accepted";
      status.textContent = `✅ مقبولة: ${task.reviewMessage}`;
      verifyBtn.disabled = true;
      fileInput.disabled = true;
    } else if (task.reviewStatus === "rejected") {
      status.className = "status rejected";
      status.textContent = `❌ مرفوضة: ${task.reviewMessage}`;
      verifyBtn.disabled = true;
      fileInput.disabled = true;
    }

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      task.proof = {
        name: file.name,
        size: file.size,
        type: file.type,
      };
      status.className = "status waiting";
      status.textContent = "الصورة مرفوعة، جاهزة للمراجعة.";
      saveState();
    });

    verifyBtn.addEventListener("click", () => {
      if (!task.proof) {
        status.className = "status rejected";
        status.textContent = "❌ لازم ترفع صورة قبل المراجعة.";
        return;
      }

      const result = runAiReview(task);
      task.reviewStatus = result.accepted ? "accepted" : "rejected";
      task.reviewMessage = result.message;

      if (result.accepted) {
        state.points += 10;
        status.className = "status accepted";
        status.textContent = `✅ ${result.message} (+10 نقاط)`;
      } else {
        state.points -= 15;
        status.className = "status rejected";
        status.textContent = `❌ ${result.message} (-15 نقطة)`;
      }

      verifyBtn.disabled = true;
      fileInput.disabled = true;

      saveState();
      render();
    });

    tasksList.appendChild(node);
  });
}

function runAiReview(task) {
  const titleWords = task.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const fileName = (task.proof.name || "").toLowerCase();
  const hasKeywordMatch = titleWords.some((word) => fileName.includes(word));

  const score = (hasKeywordMatch ? 0.6 : 0.2) + (task.proof.size > 15000 ? 0.3 : 0.1);

  if (score >= 0.7) {
    return {
      accepted: true,
      message: "الذكاء الاصطناعي راجع الصورة ووافق إن المهمة غالباً اتعملت.",
    };
  }

  return {
    accepted: false,
    message: "الذكاء الاصطناعي مش متأكد إن الصورة تخص المهمة المطلوبة.",
  };
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const title = document.getElementById("taskTitle").value.trim();
  const time = document.getElementById("taskTime").value;

  if (!title || !time) return;

  state.tasks.unshift({
    id: crypto.randomUUID(),
    title,
    time,
    proof: null,
    reviewStatus: "pending",
    reviewMessage: "",
  });

  saveState();
  taskForm.reset();
  render();
});

document.querySelectorAll(".shop-buttons button").forEach((button) => {
  button.addEventListener("click", () => {
    const points = Number(button.dataset.points);
    const price = Number(button.dataset.price);
    state.points += points;
    saveState();
    render();
    alert(`تم شراء ${points} نقطة بنجاح (محاكاة دفع ${price}$).`);
  });
});
