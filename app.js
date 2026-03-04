(function () {
  const API_URL =
    "https://script.google.com/macros/s/AKfycbxc1vHrMpPMWKUO5mVSu7PVBm7voHgo5-sX5Me6swdrVQtwIQY6QU3WnS45UXnnALgI/exec";

  // ✅ 고정 목록(즉시 렌더)
  const CARS = ["산타페", "카니발"];
  const DRIVERS = ["이준호", "강인재", "나가온", "지하영", "김태황"];

  const $ = (id) => document.getElementById(id);

  const modeCheckoutBtn = $("modeCheckout");
  const modeReturnBtn = $("modeReturn");
  const modeHint = $("modeHint");
  const modePill = $("modePill");

  const carSelect = $("carSelect");
  const depDriverSelect = $("depDriverSelect");
  const arrDriverSelect = $("arrDriverSelect");

  const depNow = $("depNow");
  const depManualToggle = $("depManualToggle");
  const depManual = $("depManual");

  const arrNow = $("arrNow");
  const arrManualToggle = $("arrManualToggle");
  const arrManual = $("arrManual");

  const checkoutSection = $("checkoutSection");
  const returnSection = $("returnSection");

  const spotPreview = $("spotPreview");
  const spotClear = $("spotClear");

  const saveBtn = $("saveBtn");
  const toast = $("toast");

  const savingOverlay = $("savingOverlay");
  const savingText = $("savingText");

  let mode = "checkout";
  let selectedSpot = "";
  let busy = false;

  function showToast(msg, ok = true) {
    toast.textContent = msg;
    toast.style.color = ok ? "#065f46" : "#991b1b";
    setTimeout(() => (toast.textContent = ""), 2500);
  }

  function showBusy(on, text) {
    busy = on;
    if (savingText) savingText.textContent = text || "처리 중…";
    if (savingOverlay) {
      savingOverlay.hidden = !on;
      savingOverlay.classList.toggle("hidden", !on);
    }
    saveBtn.disabled = on;
    modeCheckoutBtn.disabled = on;
    modeReturnBtn.disabled = on;
    depNow.disabled = on;
    arrNow.disabled = on;
    depManualToggle.disabled = on;
    arrManualToggle.disabled = on;
    if (spotClear) spotClear.disabled = on;
    document.querySelectorAll(".spot").forEach((b) => (b.disabled = on));
  }

  function fillSelect(selectEl, items, placeholder) {
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);

    items.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }

  function setMode(next) {
    mode = next;
    const isCheckout = mode === "checkout";

    modeCheckoutBtn.classList.toggle("primary", isCheckout);
    modeReturnBtn.classList.toggle("primary", !isCheckout);

    checkoutSection.classList.toggle("hidden", !isCheckout);
    checkoutSection.hidden = !isCheckout;

    returnSection.classList.toggle("hidden", isCheckout);
    returnSection.hidden = isCheckout;

    modePill.textContent = isCheckout ? "출차" : "입차";
    saveBtn.textContent = isCheckout ? "출차 저장" : "입차 저장";

    if (modeHint) {
      modeHint.innerHTML = isCheckout
        ? `<span class="step on">1 차량</span><span class="step on">2 출차운전자</span><span class="step on">3 출차시간</span><span class="step on">4 저장</span>`
        : `<span class="step on">1 차량</span><span class="step on">2 입차운전자</span><span class="step on">3 입차시간</span><span class="step on">4 주차위치</span><span class="step on">5 저장</span>`;
    }

    if (isCheckout) clearSpot();
  }

  function toDatetimeLocalValue(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function toSheetTimeString(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function toggleManual(inputEl, btnEl) {
    const willEnable = inputEl.readOnly;
    inputEl.readOnly = !willEnable ? true : false;
    btnEl.classList.toggle("primary", willEnable);
    if (willEnable) inputEl.focus();
  }

  function clearSpot() {
    selectedSpot = "";
    document.querySelectorAll(".spot").forEach((b) => b.classList.remove("selected"));
    if (spotPreview) spotPreview.textContent = "선택된 위치: 없음";
  }

  function initSpots() {
    document.querySelectorAll(".spot").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".spot").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedSpot = btn.dataset.spot;
        if (spotPreview) spotPreview.textContent = "선택된 위치: " + selectedSpot;
      });
    });
    if (spotClear) spotClear.addEventListener("click", clearSpot);
  }

  async function postNoCors(payload) {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  }

  async function save() {
    if (busy) return;
    showBusy(true, mode === "checkout" ? "출차 저장 중…" : "입차 저장 중…");

    try {
      const car = carSelect.value;
      if (!car) throw new Error("차량을 선택해줘!");

      if (mode === "checkout") {
        const depDriver = depDriverSelect.value;
        if (!depDriver) throw new Error("출차 운전자를 선택해줘!");
        if (!depManual.value) depManual.value = toDatetimeLocalValue(new Date());
        const depTime = toSheetTimeString(new Date(depManual.value));

        await postNoCors({ mode:"checkout", car, departureTime: depTime, departureDriver: depDriver });
        showToast("출차 저장 완료!", true);
        return;
      }

      const arrDriver = arrDriverSelect.value;
      if (!arrDriver) throw new Error("입차 운전자를 선택해줘!");
      if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
      const arrTime = toSheetTimeString(new Date(arrManual.value));
      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");

      await postNoCors({ mode:"return", car, arrivalTime: arrTime, arrivalDriver: arrDriver, parkingSpot: selectedSpot });

      clearSpot();
      showToast("입차 저장 완료!", true);
    } catch (e) {
      showToast(e.message || "저장 실패", false);
    } finally {
      showBusy(false);
    }
  }

  // events
  modeCheckoutBtn.addEventListener("click", () => setMode("checkout"));
  modeReturnBtn.addEventListener("click", () => setMode("return"));

  depNow.addEventListener("click", () => (depManual.value = toDatetimeLocalValue(new Date())));
  arrNow.addEventListener("click", () => (arrManual.value = toDatetimeLocalValue(new Date())));

  depManualToggle.addEventListener("click", () => toggleManual(depManual, depManualToggle));
  arrManualToggle.addEventListener("click", () => toggleManual(arrManual, arrManualToggle));

  saveBtn.addEventListener("click", save);

  // boot (✅ 즉시 렌더)
  showBusy(false);
  fillSelect(carSelect, CARS, "차량 선택");
  fillSelect(depDriverSelect, DRIVERS, "출차 운전자 선택");
  fillSelect(arrDriverSelect, DRIVERS, "입차 운전자 선택");

  setMode("checkout");
  initSpots();
})();
