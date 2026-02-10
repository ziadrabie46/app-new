const STORAGE_KEY = "taskup-state-v2";

const els = {
  navLinks: document.querySelectorAll(".nav-link"),
  tabs: document.querySelectorAll(".tab"),
  jumps: document.querySelectorAll(".jump"),
  pointsValue: document.getElementById("pointsValue"),
  doneCount: document.getElementById("doneCount"),
  rejectedCount: document.getElementById("rejectedCount"),
  scoreRate: document.getElementById("scoreRate"),
  taskForm: document.getElementById("taskForm"),
  tasksList: document.getElementById("tasksList"),
  taskTemplate: document.getElementById("taskTemplate"),
  transactionsList: document.getElementById("transactionsList"),
  transactionTemplate: document.getElementById("transactionTemplate"),
  packages: document.getElementById("packages"),
  checkoutForm: document.getElementById("checkoutForm"),
  selectedPackage: document.getElementById("selectedPackage"),
  payBtn: document.getElementById("payBtn"),
  usernameInput: document.getElementById("usernameInput"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  profileHint: document.getElementById("profileHint"),
};

const state = loadState();
checkExpiredTasks();
bindUi();
renderAll();

function loadState() {
  const fallback = {
    user: { name: "مستخدم جديد" },
    points: 120,
    selectedPackage: null,
    tasks: [],
    transactions: [],
  };

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;

  try {
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bindUi() {
  els.navLinks.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  els.jumps.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.jump));
  });

  els.taskForm.addEventListener("submit", addTask);
  els.packages.addEventListener("click", selectPackage);
  els.checkoutForm.addEventListener("submit", processPayment);
  els.saveProfileBtn.addEventListener("click", saveProfile);

  document.getElementById("cardNumber").addEventListener("input", formatCardNumber);
  document.getElementById("cardExpiry").addEventListener("input", formatExpiry);
}

function switchTab(tabId) {
  els.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.tab === tabId));
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.id === tabId));
}

function addTask(event) {
  event.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  const description = document.getElementById("taskDescription").value.trim();
  const time = document.getElementById("taskTime").value;

  if (!title || !time) return;

  state.tasks.unshift({
    id: crypto.randomUUID(),
    title,
    description,
    time,
    proof: null,
    reviewStatus: "pending",
    reviewMessage: "",
    expiredPenaltyApplied: false,
  });

  addTransaction(`تم إنشاء مهمة جديدة: ${title}`);
  saveState();
  els.taskForm.reset();
  renderAll();
}

function selectPackage(event) {
  const btn = event.target.closest(".package");
  if (!btn) return;

  state.selectedPackage = {
    points: Number(btn.dataset.points),
    price: Number(btn.dataset.price),
  };

  document.querySelectorAll(".package").forEach((p) => p.classList.remove("selected"));
  btn.classList.add("selected");

  els.selectedPackage.textContent = `الباقة المختارة: +${state.selectedPackage.points} نقطة مقابل ${state.selectedPackage.price}$`;
  els.payBtn.disabled = false;
  saveState();
}

function processPayment(event) {
  event.preventDefault();

  if (!state.selectedPackage) {
    alert("اختر باقة أولاً.");
    return;
  }

  const name = document.getElementById("cardName").value.trim();
  const cardNumber = document.getElementById("cardNumber").value.replace(/\s/g, "");
  const expiry = document.getElementById("cardExpiry").value;
  const cvv = document.getElementById("cardCvv").value.trim();

  if (!name || cardNumber.length < 16 || !/^\d{2}\/\d{2}$/.test(expiry) || cvv.length < 3) {
    alert("بيانات البطاقة غير مكتملة.");
    return;
  }

  state.points += state.selectedPackage.points;
  addTransaction(
    `عملية دفع ناجحة (${state.selectedPackage.price}$) وشحن ${state.selectedPackage.points} نقطة بواسطة ${state.user.name}`,
  );

  state.selectedPackage = null;
  els.checkoutForm.reset();
  document.querySelectorAll(".package").forEach((p) => p.classList.remove("selected"));
  els.selectedPackage.textContent = "اختر باقة أولًا.";
  els.payBtn.disabled = true;

  saveState();
  renderAll();
  alert("✅ تمت عملية الدفع بنجاح وتمت إضافة النقاط.");
}

function saveProfile() {
  const newName = els.usernameInput.value.trim();
  if (!newName) {
    els.profileHint.textContent = "الرجاء إدخال اسم صالح.";
    return;
  }
  state.user.name = newName;
  addTransaction(`تم تحديث اسم الحساب إلى: ${newName}`);
  saveState();
  els.profileHint.textContent = "تم حفظ بيانات الحساب بنجاح.";
}

function renderTasks() {
  if (!state.tasks.length) {
    els.tasksList.classList.add("empty");
    els.tasksList.textContent = "لا توجد مهام حالياً.";
    return;
  }

  els.tasksList.classList.remove("empty");
  els.tasksList.textContent = "";

  state.tasks.forEach((task) => {
    const node = els.taskTemplate.content.firstElementChild.cloneNode(true);

    node.querySelector(".title").textContent = task.title;
    node.querySelector(".description").textContent = task.description || "بدون وصف";
    node.querySelector(".time").textContent = `موعد التنفيذ: ${new Date(task.time).toLocaleString("ar-EG")}`;

    const fileInput = node.querySelector(".proof");
    const verifyBtn = node.querySelector(".verify-btn");
    const deleteBtn = node.querySelector(".delete-btn");
    const status = node.querySelector(".status");

    if (task.reviewStatus === "accepted") {
      status.className = "status accepted";
      status.textContent = `✅ ${task.reviewMessage}`;
      verifyBtn.disabled = true;
      fileInput.disabled = true;
    } else if (task.reviewStatus === "rejected") {
      status.className = "status rejected";
      status.textContent = `❌ ${task.reviewMessage}`;
      verifyBtn.disabled = true;
      fileInput.disabled = true;
    } else if (task.reviewStatus === "expired") {
      status.className = "status expired";
      status.textContent = `⏰ ${task.reviewMessage}`;
      verifyBtn.disabled = true;
      fileInput.disabled = true;
    }

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      task.proof = { name: file.name, size: file.size, type: file.type };
      status.className = "status waiting";
      status.textContent = "تم رفع الإثبات. جاهز للمراجعة.";
      saveState();
    });

    verifyBtn.addEventListener("click", () => reviewTask(task));

    deleteBtn.addEventListener("click", () => {
      state.tasks = state.tasks.filter((t) => t.id !== task.id);
      addTransaction(`تم حذف المهمة: ${task.title}`);
      saveState();
      renderAll();
    });

    els.tasksList.appendChild(node);
  });
}

function reviewTask(task) {
  if (!task.proof) {
    alert("لازم ترفع صورة أولاً.");
    return;
  }

  const result = runAiReview(task);
  task.reviewStatus = result.accepted ? "accepted" : "rejected";
  task.reviewMessage = result.message;

  if (result.accepted) {
    state.points += 12;
    addTransaction(`تم قبول المهمة: ${task.title} (+12)`);
  } else {
    state.points -= 20;
    addTransaction(`تم رفض المهمة: ${task.title} (-20)`);
  }

  saveState();
  renderAll();
}

function runAiReview(task) {
  const titleWords = task.title.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const fileName = (task.proof.name || "").toLowerCase();
  const hasKeyword = titleWords.some((w) => fileName.includes(w));
  const enoughSize = task.proof.size > 12000;

  if (hasKeyword && enoughSize) {
    return {
      accepted: true,
      message: "الـ AI قيّم الصورة بأنها متوافقة مع المهمة.",
    };
  }

  return {
    accepted: false,
    message: "الصورة غير كافية أو لا تطابق وصف المهمة.",
  };
}

function checkExpiredTasks() {
  const now = Date.now();

  state.tasks.forEach((task) => {
    const due = new Date(task.time).getTime();
    const isPending = task.reviewStatus === "pending";
    if (!isPending || task.expiredPenaltyApplied) return;

    if (due < now && !task.proof) {
      task.reviewStatus = "expired";
      task.reviewMessage = "انتهى وقت المهمة بدون إثبات.";
      task.expiredPenaltyApplied = true;
      state.points -= 10;
      addTransaction(`انتهت مهمة بدون إثبات: ${task.title} (-10)`);
    }
  });

  saveState();
}

function addTransaction(message) {
  state.transactions.unshift({
    id: crypto.randomUUID(),
    message,
    time: new Date().toISOString(),
  });

  state.transactions = state.transactions.slice(0, 120);
}

function renderTransactions() {
  if (!state.transactions.length) {
    els.transactionsList.classList.add("empty");
    els.transactionsList.textContent = "لا يوجد سجل حتى الآن.";
    return;
  }

  els.transactionsList.classList.remove("empty");
  els.transactionsList.textContent = "";

  state.transactions.forEach((tx) => {
    const node = els.transactionTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".tx-title").textContent = tx.message;
    node.querySelector(".tx-time").textContent = new Date(tx.time).toLocaleString("ar-EG");
    els.transactionsList.appendChild(node);
  });
}

function renderStats() {
  const accepted = state.tasks.filter((t) => t.reviewStatus === "accepted").length;
  const rejected = state.tasks.filter((t) => t.reviewStatus === "rejected" || t.reviewStatus === "expired").length;
  const reviewed = accepted + rejected;
  const rate = reviewed ? Math.round((accepted / reviewed) * 100) : 0;

  els.pointsValue.textContent = state.points;
  els.doneCount.textContent = accepted;
  els.rejectedCount.textContent = rejected;
  els.scoreRate.textContent = `${rate}%`;
}

function renderProfile() {
  els.usernameInput.value = state.user.name;
}

function renderAll() {
  renderStats();
  renderTasks();
  renderTransactions();
  renderProfile();
}

function formatCardNumber(event) {
  const value = event.target.value.replace(/\D/g, "").slice(0, 16);
  event.target.value = value.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(event) {
  const value = event.target.value.replace(/\D/g, "").slice(0, 4);
  event.target.value = value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
}
