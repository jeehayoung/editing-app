(function () {
  const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbxc1vHrMpPMWKUO5mVSu7PVBm7voHgo5-sX5Me6swdrVQtwIQY6QU3WnS45UXnnALgI/exec";

  const $ = (id) => document.getElementById(id);

  // top bar
  const todayText = $("todayText");
  const modePill = $("modePill");

  // status
  const statusSantaValue = $("statusSantaValue");
  const statusCarnivalValue = $("statusCarnivalValue");

  // mode
  const modeCheckoutBtn = $("modeCheckout");
  const modeReturnBtn = $("modeReturn");
  const modeHint = $("modeHint");

  // inputs
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

  // action
  const saveBtn = $("saveBtn");
  const toast = $("toast");

  const savingOverlay = $("savingOverlay");
  const savingText = $("savingText");

  // recent table
  const recentTableBody = $("recentTableBody");
  const refreshRecent = $("refreshRecent");

  let mode = "checkout"; // checkout | return
  let selectedSpot = "";
  let busy = false;

  // cache
  const CACHE_KEY = "moin_vehicle_cache_v2";
  const cache = readCache();

  // cache structure:
  // cache.openTrip = { [car]: { car, depTime, depDriver } }
  // cache.recentRows = [ {car, depTime, depDriver, arrTime, arrDriver, spot, ts} ]
  // cache.status = { [car]: { state, depTime, depDriver } }  (표시용)

  function readCache() {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      if (!v.openTrip) v.openTrip = {};
      if (!v.recentRows) v.recentRows = [];
      if (!v.status) v.status = {};
      return v;
    } catch {
      return { openTrip: {}, recentRows: [], status: {} };
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

  function setToday() {
    const d = new Date();
    todayText.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
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

    if (isCheckout) {
      modeHint.innerHTML = `
        <span class="step on">1 차량</span>
        <span class="step on">2 출차운전자</span>
        <span class="step on">3 출차시간</span>
        <span class="step on">4 저장</span>
      `;
      saveBtn.textContent = "출차 저장";
      clearSpot();
    } else {
      modeHint.innerHTML = `
        <span class="step on">1 차량</span>
        <span class="step on">2 입차운전자</span>
        <span class="step on">3 입차시간</span>
        <span class="step on">4 주차위치</span>
        <span class="step on">5 저장</span>
      `;
      saveBtn.textContent = "입차 저장";
    }
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

  // JSONP
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

  function updateStatusUI() {
    // status is derived from openTrip
    const open = cache.openTrip || {};
    statusSantaValue.textContent = open["산타페"]
      ? `미반납 · ${open["산타페"].depTime} / ${open["산타페"].depDriver}`
      : "사용 가능";

    statusCarnivalValue.textContent = open["카니발"]
      ? `미반납 · ${open["카니발"].depTime} / ${open["카니발"].depDriver}`
      : "사용 가능";
  }

  function renderRecentTable() {
    const rows = (cache.recentRows || []).slice(0, 5);

    if (!rows.length) {
      recentTableBody.innerHTML = `<tr><td class="sticky-col">-</td><td colspan="5">기록이 없습니다.</td></tr>`;
      return;
    }

    recentTableBody.innerHTML = rows.map(r => {
      const car = r.car || "";
      const depTime = r.depTime || "";
      const depDriver = r.depDriver || "";
      const arrTime = r.arrTime || "";
      const arrDriver = r.arrDriver || "";
      const spot = r.spot || "";

      return `
        <tr>
          <td class="sticky-col">${escapeHtml(car)}</td>
          <td>${escapeHtml(depTime)}</td>
          <td>${escapeHtml(depDriver)}</td>
          <td>${escapeHtml(arrTime)}</td>
          <td>${escapeHtml(arrDriver)}</td>
          <td>${escapeHtml(spot)}</td>
        </tr>
      `;
    }).join("");
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
    updateStatusUI();
  }

  async function loadLists() {
    const carsRes = await fetchJSONP(DEFAULT_API_URL + "?action=cars");
    const driversRes = await fetchJSONP(DEFAULT_API_URL + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(depDriverSelect, driversRes.drivers || [], "출차 운전자 선택");
    fillSelect(arrDriverSelect, driversRes.drivers || [], "입차 운전자 선택");

    // 캐시 기반 렌더
    updateStatusUI();
    renderRecentTable();
  }

  function validateCar() {
    const car = carSelect.value;
    if (!car) throw new Error("차량을 선택해줘!");
    return car;
  }

  async function save() {
    if (busy) return;

    showBusy(true, mode === "checkout" ? "출차 저장 중…" : "입차 저장 중…");

    try {
      const car = validateCar();

      if (mode === "checkout") {
        const depDriver = depDriverSelect.value;
        if (!depDriver) throw new Error("출차 운전자를 선택해줘!");
        if (!depManual.value) depManual.value = toDatetimeLocalValue(new Date());
        const depTime = toSheetTimeString(new Date(depManual.value));

        // 서버 저장
        await postNoCors({
          mode: "checkout",
          car,
          departureTime: depTime,
          departureDriver: depDriver,
        });

        // 캐시에 openTrip 저장
        cache.openTrip[car] = { car, depTime, depDriver };
        writeCache();
        updateStatusUI();

        // 표에는 출차만 기록된 행도 “부분 행”으로 보여줄지 고민인데,
        // 요청이 "모두 볼 수 있도록"이라 출차행도 남기되 입차칸은 비워둠
        pushRecentRow({
          car,
          depTime,
          depDriver,
          arrTime: "",
          arrDriver: "",
          spot: "",
          ts: Date.now(),
        });

        showToast("출차 저장 완료!", true);
        return;
      }

      // return
      const arrDriver = arrDriverSelect.value;
      if (!arrDriver) throw new Error("입차 운전자를 선택해줘!");
      if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
      const arrTime = toSheetTimeString(new Date(arrManual.value));
      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");

      // 서버 업데이트
      await postNoCors({
        mode: "return",
        car,
        arrivalTime: arrTime,
        arrivalDriver: arrDriver,
        parkingSpot: selectedSpot,
      });

      // openTrip에서 출차정보 가져오기(있으면)
      const open = cache.openTrip[car];
      const depTime = open ? open.depTime : "";
      const depDriver = open ? open.depDriver : "";

      // 반납 완료 → openTrip 제거
      delete cache.openTrip[car];
      writeCache();
      updateStatusUI();

      pushRecentRow({
        car,
        depTime,
        depDriver,
        arrTime,
        arrDriver,
        spot: selectedSpot,
        ts: Date.now(),
      });

      clearSpot();
      showToast("입차 저장 완료!", true);
    } catch (e) {
      showToast(e && e.message ? e.message : "저장 실패", false);
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

  refreshRecent.addEventListener("click", () => {
    // 캐시 기반 재렌더
    renderRecentTable();
    updateStatusUI();
    showToast("새로고침 완료", true);
  });

  // boot
  showBusy(false);
  setToday();
  setMode("checkout");
  initSpots();
  loadLists().catch((e) => showToast("목록 조회 실패: " + (e && e.message ? e.message : "unknown"), false));
})();
