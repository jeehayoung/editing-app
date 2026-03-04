(function () {
  const API_URL =
    "https://script.google.com/macros/s/AKfycbxc1vHrMpPMWKUO5mVSu7PVBm7voHgo5-sX5Me6swdrVQtwIQY6QU3WnS45UXnnALgI/exec";

  // ✅ GET 안 쓰는 초경량: 여기에만 추가/수정하면 됨
  const CARS = ["산타페 214서 4346", "카니발 41루 5831"];
  const DRIVERS = ["이준호", "강인재", "김태황", "나가온", "지하영", "백진희"];

  const $ = (id) => document.getElementById(id);

  const modeCheckoutBtn = $("modeCheckout");
  const modeReturnBtn = $("modeReturn");

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

  const recentList = $("recentList");

  let mode = "checkout";
  let selectedSpot = "";
  let busy = false;

  // local cache for recent (device only)
  const CACHE_KEY = "moin_recent_v1";
  const cache = readCache();

  function readCache() {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      if (!v.recent) v.recent = [];
      return v;
    } catch {
      return { recent: [] };
    }
  }
  function writeCache() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function showToast(msg, ok = true) {
    toast.textContent = msg;
    toast.style.color = ok ? "#065f46" : "#991b1b";
    setTimeout(() => (toast.textContent = ""), 2500);
  }

  function showBusy(on, text) {
    busy = on;
    if (savingText) savingText.textContent = text || "열시미 저장중…";
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

    saveBtn.textContent = isCheckout ? "출차 저장" : "입차 저장";

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

  function addRecent(item) {
    cache.recent = [item, ...(cache.recent || [])].slice(0, 5);
    writeCache();
    renderRecent();
  }

  function renderRecent() {
    if (!recentList) return;

    const list = cache.recent || [];
    if (!list.length) {
      recentList.innerHTML = `<div class="hint">최근 입력이 없습니다.</div>`;
      return;
    }

    recentList.innerHTML = list.map((it) => {
      const tagClass = it.mode === "checkout" ? "checkout" : (it.mode === "return" ? "return" : "checkout");
      const tagText = it.mode === "checkout" ? "출차" : (it.mode === "return" ? "입차" : "기록");

      const lines = [
        `${it.car || ""}`,
        it.mode === "checkout"
          ? `출차: ${it.departureTime || ""} / ${it.departureDriver || ""}`
          : `입차: ${it.arrivalTime || ""} / ${it.arrivalDriver || ""} / ${it.parkingSpot || ""}`
      ].join("<br>");

      const cancelBtn = it.recordId
        ? `<button class="btn danger" type="button" data-cancel="${it.recordId}">취소</button>`
        : "";

      return `
        <div class="recent-item">
          <div class="recent-top">
            <span class="tag ${tagClass}">${tagText}</span>
            <span style="font-size:12px;color:#6b7280">${it.recordId || ""}</span>
          </div>
          <div class="recent-body">${lines}</div>
          <div class="recent-actions">${cancelBtn}</div>
        </div>
      `;
    }).join("");

    // bind cancel buttons
    recentList.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const rid = btn.getAttribute("data-cancel");
        const cancelUser = (mode === "checkout" ? depDriverSelect.value : arrDriverSelect.value) || "미상";

        if (!rid) return;

        showBusy(true, "취소 처리 중…");
        try {
          await postNoCors({ mode:"cancel", recordId: rid, cancelUser });

          // remove from list immediately
          cache.recent = (cache.recent || []).filter(x => x.recordId !== rid);
          writeCache();
          renderRecent();

          showToast("취소 처리 완료!", true);
        } catch (e) {
          showToast("취소 실패(네트워크): 다시 시도해줘", false);
        } finally {
          showBusy(false);
        }
      });
    });
  }

  async function postNoCors(payload) {
    // POST는 no-cors로 전송만 (응답 읽지 않음)
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  }

  async function save() {
    if (busy) return;

    showBusy(true, mode === "checkout" ? "열시미 저장중…" : "열시미 저장중…");

    try {
      const car = carSelect.value;
      if (!car) throw new Error("차량을 선택해줘!");

      if (mode === "checkout") {
        const depDriver = depDriverSelect.value;
        if (!depDriver) throw new Error("출차 운전자를 선택해줘!");
        if (!depManual.value) depManual.value = toDatetimeLocalValue(new Date());

        const departureTime = toSheetTimeString(new Date(depManual.value));

        // send
        await postNoCors({ mode:"checkout", car, departureTime, departureDriver: depDriver });

        // recordId는 서버가 생성하지만 응답을 못 읽으니,
        // 로컬에서도 "임시ID"를 만들어서 취소 가능하게 하려면 서버가 recordId를 반환해야 함.
        // 그래서 여기서는 임시ID 대신 "서버 생성 recordId가 필요" → 취소 버튼은 recordId가 있을 때만 생성됨.
        // (원하면 응답을 읽을 수 있는 방식으로도 바꿔줄 수 있어)
        addRecent({ mode:"checkout", car, departureTime, departureDriver: depDriver, recordId: "" });

        showToast("출차 저장 완료! (시트에서 기록ID 확인 가능)", true);
        return;
      }

      // return
      const arrDriver = arrDriverSelect.value;
      if (!arrDriver) throw new Error("입차 운전자를 선택해줘!");
      if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
      const arrivalTime = toSheetTimeString(new Date(arrManual.value));

      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");

      await postNoCors({ mode:"return", car, arrivalTime, arrivalDriver: arrDriver, parkingSpot: selectedSpot });

      clearSpot();
      addRecent({ mode:"return", car, arrivalTime, arrivalDriver: arrDriver, parkingSpot: selectedSpot, recordId: "" });

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

  // boot (즉시)
  showBusy(false);
  fillSelect(carSelect, CARS, "차량 선택");
  fillSelect(depDriverSelect, DRIVERS, "출차 운전자 선택");
  fillSelect(arrDriverSelect, DRIVERS, "입차 운전자 선택");
  setMode("checkout");
  initSpots();
  renderRecent();
})();
