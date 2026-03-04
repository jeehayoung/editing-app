(function () {
  const API_URL =
    "https://script.google.com/macros/s/AKfycbxc1vHrMpPMWKUO5mVSu7PVBm7voHgo5-sX5Me6swdrVQtwIQY6QU3WnS45UXnnALgI/exec";

  // ✅ 하영님 기준 값
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
  const modePill = $("modePill");

  let mode = "checkout";
  let selectedSpot = "";
  let busy = false;

  const CACHE_KEY = "moin_recent_trip_v1";
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
    if (modePill) modePill.textContent = isCheckout ? "출차" : "입차";

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

  // ✅ JSONP call (GET only on save/cancel, not on load)
  function jsonpCall(url) {
    return new Promise((resolve, reject) => {
      const cb = "cb_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      window[cb] = (data) => {
        resolve(data);
        delete window[cb];
        script.remove();
      };
      script.onerror = () => {
        reject(new Error("jsonp error"));
        delete window[cb];
        script.remove();
      };
      script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
      document.body.appendChild(script);
    });
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
      const tagClass = it.mode === "checkout" ? "checkout" : "return";
      const tagText = it.mode === "checkout" ? "출차" : "입차";

      const main = it.mode === "checkout"
        ? `출차: ${it.departureTime} / ${it.departureDriver}`
        : `입차: ${it.arrivalTime} / ${it.arrivalDriver} / ${it.parkingSpot}`;

      return `
        <div class="recent-item">
          <div class="recent-top">
            <span class="tag ${tagClass}">${tagText}</span>
            <span style="font-size:12px;color:#6b7280">${it.recordId || ""}</span>
          </div>
          <div class="recent-body">
            ${it.car}<br>${main}
          </div>
          <div class="recent-actions">
            <button class="btn danger" type="button" data-cancel="${it.recordId}">취소</button>
          </div>
        </div>
      `;
    }).join("");

    recentList.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", cancelRecord);
    });
  }

  async function checkout() {
    const car = carSelect.value;
    const depDriver = depDriverSelect.value;

    if (!car) throw new Error("차량을 선택해줘!");
    if (!depDriver) throw new Error("출차 운전자를 선택해줘!");
    if (!depManual.value) depManual.value = toDatetimeLocalValue(new Date());
    const departureTime = toSheetTimeString(new Date(depManual.value));

    const url =
      API_URL +
      `?action=checkout` +
      `&car=${encodeURIComponent(car)}` +
      `&departureTime=${encodeURIComponent(departureTime)}` +
      `&departureDriver=${encodeURIComponent(depDriver)}`;

    const res = await jsonpCall(url);
    if (!res || res.ok !== true) throw new Error(res && res.error ? res.error : "출차 저장 실패");

    return { car, departureTime, departureDriver: depDriver, recordId: res.recordId };
  }

  async function returnCar() {
    const car = carSelect.value;
    const arrDriver = arrDriverSelect.value;

    if (!car) throw new Error("차량을 선택해줘!");
    if (!arrDriver) throw new Error("입차 운전자를 선택해줘!");
    if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
    const arrivalTime = toSheetTimeString(new Date(arrManual.value));

    if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");
    const parkingSpot = selectedSpot;

    const url =
      API_URL +
      `?action=return` +
      `&car=${encodeURIComponent(car)}` +
      `&arrivalTime=${encodeURIComponent(arrivalTime)}` +
      `&arrivalDriver=${encodeURIComponent(arrDriver)}` +
      `&parkingSpot=${encodeURIComponent(parkingSpot)}`;

    const res = await jsonpCall(url);
    if (!res || res.ok !== true) throw new Error(res && res.error ? res.error : "입차 저장 실패");

    return { car, arrivalTime, arrivalDriver: arrDriver, parkingSpot, recordId: res.recordId || "" };
  }

  async function cancelRecord(ev) {
    const rid = ev.currentTarget.getAttribute("data-cancel");
    const who =
      (mode === "checkout" ? depDriverSelect.value : arrDriverSelect.value) ||
      "미상";

    if (!rid) return;

    showBusy(true, "취소 처리 중…");
    try {
      const url =
        API_URL +
        `?action=cancel` +
        `&recordId=${encodeURIComponent(rid)}` +
        `&cancelUser=${encodeURIComponent(who)}`;

      const res = await jsonpCall(url);
      if (!res || res.ok !== true) throw new Error(res && res.error ? res.error : "취소 실패");

      cache.recent = (cache.recent || []).filter(x => x.recordId !== rid);
      writeCache();
      renderRecent();

      showToast("취소 처리 완료!", true);
    } catch (e) {
      showToast(e.message || "취소 실패", false);
    } finally {
      showBusy(false);
    }
  }

  async function save() {
    if (busy) return;
    showBusy(true, "열시미 저장중…");

    try {
      if (mode === "checkout") {
        const item = await checkout();
        addRecent({ ...item, mode: "checkout" });
        showToast("출차 저장 완료!", true);
      } else {
        const item = await returnCar();
        addRecent({ ...item, mode: "return" });
        clearSpot();
        showToast("입차 저장 완료!", true);
      }
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

  // boot
  showBusy(false);
  fillSelect(carSelect, CARS, "차량 선택");
  fillSelect(depDriverSelect, DRIVERS, "출차 운전자 선택");
  fillSelect(arrDriverSelect, DRIVERS, "입차 운전자 선택");
  setMode("checkout");
  initSpots();
  renderRecent();
})();
