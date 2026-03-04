(function () {
  const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbxc1vHrMpPMWKUO5mVSu7PVBm7voHgo5-sX5Me6swdrVQtwIQY6QU3WnS45UXnnALgI/exec";

  const $ = (id) => document.getElementById(id);

  const modeCheckoutBtn = $("modeCheckout");
  const modeReturnBtn = $("modeReturn");
  const modeHint = $("modeHint");

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

  const recentTableBody = $("recentTableBody");
  const refreshRecent = $("refreshRecent");

  let mode = "checkout";
  let selectedSpot = "";
  let busy = false;

  const CACHE_KEY = "moin_vehicle_cache_v2";
  const cache = readCache();

  function readCache() {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      if (!v.openTrip) v.openTrip = {};
      if (!v.recentRows) v.recentRows = [];
      return v;
    } catch {
      return { openTrip: {}, recentRows: [] };
    }
  }

  function writeCache() {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function showToast(msg, ok = true) {
    if (!toast) return;
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
    if (saveBtn) saveBtn.disabled = on;
    if (modeCheckoutBtn) modeCheckoutBtn.disabled = on;
    if (modeReturnBtn) modeReturnBtn.disabled = on;
    if (depNow) depNow.disabled = on;
    if (arrNow) arrNow.disabled = on;
    if (depManualToggle) depManualToggle.disabled = on;
    if (arrManualToggle) arrManualToggle.disabled = on;
    if (spotClear) spotClear.disabled = on;

    document.querySelectorAll(".spot").forEach((b) => (b.disabled = on));
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
    if (!inputEl || !btnEl) return;
    const willEnable = inputEl.readOnly;
    inputEl.readOnly = !willEnable ? true : false;
    btnEl.classList.toggle("primary", willEnable);
    if (willEnable) inputEl.focus();
  }

  function fetchJSONP(url) {
    return new Promise((resolve, reject) => {
      const cbName = "cb_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const sep = url.includes("?") ? "&" : "?";

      window[cbName] = (data) => {
        resolve(data);
        delete window[cbName];
        script.remove();
      };

      script.onerror = () => {
        reject(new Error("Failed to fetch (JSONP)"));
        delete window[cbName];
        script.remove();
      };

      script.src = url + sep + "callback=" + cbName;
      document.body.appendChild(script);
    });
  }

  function fillSelect(selectEl, items, placeholder) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    selectEl.appendChild(opt0);

    (items || []).forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
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
    await fetch(DEFAULT_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  }

  function setMode(next) {
    mode = next;
    const isCheckout = mode === "checkout";

    if (modeCheckoutBtn) modeCheckoutBtn.classList.toggle("primary", isCheckout);
    if (modeReturnBtn) modeReturnBtn.classList.toggle("primary", !isCheckout);

    if (checkoutSection) {
      checkoutSection.classList.toggle("hidden", !isCheckout);
      checkoutSection.hidden = !isCheckout;
    }
    if (returnSection) {
      returnSection.classList.toggle("hidden", isCheckout);
      returnSection.hidden = isCheckout;
    }

    if (saveBtn) saveBtn.textContent = isCheckout ? "출차 저장" : "입차 저장";

    // ✅ 여기서 null이면 그냥 스킵
    if (modeHint) {
      modeHint.innerHTML = isCheckout
        ? `<span class="step on">1 차량</span><span class="step on">2 출차운전자</span><span class="step on">3 출차시간</span><span class="step on">4 저장</span>`
        : `<span class="step on">1 차량</span><span class="step on">2 입차운전자</span><span class="step on">3 입차시간</span><span class="step on">4 주차위치</span><span class="step on">5 저장</span>`;
    }

    if (isCheckout) clearSpot();
  }

  function renderRecentTable() {
    if (!recentTableBody) return; // ✅ 없으면 스킵

    const rows = (cache.recentRows || []).slice(0, 5);
    if (!rows.length) {
      recentTableBody.innerHTML = `<tr><td class="sticky-col">-</td><td colspan="5">기록이 없습니다.</td></tr>`;
      return;
    }

    recentTableBody.innerHTML = rows.map(r => `
      <tr>
        <td class="sticky-col">${escapeHtml(r.car || "")}</td>
        <td>${escapeHtml(r.depTime || "")}</td>
        <td>${escapeHtml(r.depDriver || "")}</td>
        <td>${escapeHtml(r.arrTime || "")}</td>
        <td>${escapeHtml(r.arrDriver || "")}</td>
        <td>${escapeHtml(r.spot || "")}</td>
      </tr>
    `).join("");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  function pushRecentRow(row) {
    cache.recentRows = [row, ...(cache.recentRows || [])].slice(0, 5);
    writeCache();
    renderRecentTable();
  }

  async function loadLists() {
    const carsRes = await fetchJSONP(DEFAULT_API_URL + "?action=cars");
    const driversRes = await fetchJSONP(DEFAULT_API_URL + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(depDriverSelect, driversRes.drivers || [], "출차 운전자 선택");
    fillSelect(arrDriverSelect, driversRes.drivers || [], "입차 운전자 선택");

    renderRecentTable();
  }

  async function save() {
    if (busy) return;
    showBusy(true, mode === "checkout" ? "출차 저장 중…" : "입차 저장 중…");

    try {
      const car = carSelect ? carSelect.value : "";
      if (!car) throw new Error("차량을 선택해줘!");

      if (mode === "checkout") {
        const depDriver = depDriverSelect ? depDriverSelect.value : "";
        if (!depDriver) throw new Error("출차 운전자를 선택해줘!");
        if (!depManual.value) depManual.value = toDatetimeLocalValue(new Date());
        const depTime = toSheetTimeString(new Date(depManual.value));

        await postNoCors({ mode:"checkout", car, departureTime: depTime, departureDriver: depDriver });

        pushRecentRow({ car, depTime, depDriver, arrTime:"", arrDriver:"", spot:"", ts: Date.now() });
        showToast("출차 저장 완료!", true);
        return;
      }

      const arrDriver = arrDriverSelect ? arrDriverSelect.value : "";
      if (!arrDriver) throw new Error("입차 운전자를 선택해줘!");
      if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
      const arrTime = toSheetTimeString(new Date(arrManual.value));
      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");

      await postNoCors({ mode:"return", car, arrivalTime: arrTime, arrivalDriver: arrDriver, parkingSpot: selectedSpot });

      pushRecentRow({ car, depTime:"", depDriver:"", arrTime, arrDriver, spot:selectedSpot, ts: Date.now() });
      clearSpot();
      showToast("입차 저장 완료!", true);
    } catch (e) {
      showToast(e && e.message ? e.message : "저장 실패", false);
    } finally {
      showBusy(false);
    }
  }

  // events (null-safe)
  if (modeCheckoutBtn) modeCheckoutBtn.addEventListener("click", () => setMode("checkout"));
  if (modeReturnBtn) modeReturnBtn.addEventListener("click", () => setMode("return"));

  if (depNow) depNow.addEventListener("click", () => (depManual.value = toDatetimeLocalValue(new Date())));
  if (arrNow) arrNow.addEventListener("click", () => (arrManual.value = toDatetimeLocalValue(new Date())));

  if (depManualToggle) depManualToggle.addEventListener("click", () => toggleManual(depManual, depManualToggle));
  if (arrManualToggle) arrManualToggle.addEventListener("click", () => toggleManual(arrManual, arrManualToggle));

  if (saveBtn) saveBtn.addEventListener("click", save);
  if (refreshRecent) refreshRecent.addEventListener("click", () => renderRecentTable());

  // boot
  showBusy(false);
  setMode("checkout");
  initSpots();
  loadLists().catch((e) => showToast("목록 조회 실패: " + (e && e.message ? e.message : "unknown"), false));
})();
