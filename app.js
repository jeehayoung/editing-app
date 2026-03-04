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

  // recent
  const recentList = $("recentList");
  const refreshRecent = $("refreshRecent");

  // integr panel
  const apiUrlInput = $("apiUrl");
  const toggleIntegr = $("toggleIntegr");
  const integrPanel = $("integrPanel");

  let mode = "checkout"; // checkout | return
  let selectedSpot = "";
  let busy = false;

  // local recent cache: 차량별 마지막 출차/입차 상태 추정 (서버 조회 없이도 UX 강화)
  const CACHE_KEY = "moin_vehicle_cache_v1";
  const cache = readCache();

  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); }
    catch { return {}; }
  }
  function writeCache(next) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next || {}));
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

    // disable core buttons
    saveBtn.disabled = on;
    modeCheckoutBtn.disabled = on;
    modeReturnBtn.disabled = on;
    depNow.disabled = on;
    arrNow.disabled = on;
    depManualToggle.disabled = on;
    arrManualToggle.disabled = on;
    spotClear && (spotClear.disabled = on);
    document.querySelectorAll(".spot").forEach((b) => (b.disabled = on));
  }

  function setToday() {
    const d = new Date();
    const mm = String(d.getMonth() + 1);
    const dd = String(d.getDate());
    todayText.textContent = `${mm}/${dd}`;
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
    modePill.classList.toggle("primary", true);

    // steps
    if (isCheckout) {
      modeHint.innerHTML = `
        <span class="step on">1 차량</span>
        <span class="step on">2 출차운전자</span>
        <span class="step on">3 출차시간</span>
        <span class="step on">4 저장</span>
      `;
      saveBtn.textContent = "출차 저장";
      clearSpot(); // 출차는 주차위치 필요없음
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

  // JSONP (CORS 우회)
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
    spotPreview && (spotPreview.textContent = "선택된 위치: 없음");
  }

  function initSpots() {
    document.querySelectorAll(".spot").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".spot").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedSpot = btn.dataset.spot;
        spotPreview && (spotPreview.textContent = "선택된 위치: " + selectedSpot);
      });
    });
    spotClear && spotClear.addEventListener("click", clearSpot);
  }

  async function postNoCors(payload) {
    await fetch(DEFAULT_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  }

  function parseQuery() {
    const p = new URLSearchParams(location.search);
    return {
      car: p.get("car") || "",
      mode: p.get("mode") || "", // checkout | return
    };
  }

  function updateStatusUI() {
    // cache format:
    // cache[car] = { state: "미반납"|"사용가능", depTime, depDriver, arrTime, arrDriver, spot }
    const santa = cache["산타페"];
    const carnival = cache["카니발"];

    statusSantaValue.textContent = formatStatus(santa);
    statusCarnivalValue.textContent = formatStatus(carnival);
  }

  function formatStatus(c) {
    if (!c || !c.state) return "사용 가능";
    if (c.state === "미반납") {
      const who = c.depDriver ? ` / ${c.depDriver}` : "";
      const when = c.depTime ? `${c.depTime}` : "출차기록";
      return `미반납 · ${when}${who}`;
    }
    return "사용 가능";
  }

  function pushRecent(event) {
    // event: {type, car, time, driver, spot?}
    const list = (cache.__recent || []);
    list.unshift({ ...event, ts: Date.now() });
    cache.__recent = list.slice(0, 5);
    writeCache(cache);
    renderRecent();
    updateStatusUI();
  }

  function renderRecent() {
    const list = cache.__recent || [];
    if (!list.length) {
      recentList.innerHTML = `<div class="hint">아직 기록이 없습니다.</div>`;
      return;
    }

    recentList.innerHTML = list.map((it) => {
      const tagClass = it.type === "checkout" ? "checkout" : "return";
      const tagText = it.type === "checkout" ? "출차" : "입차";
      const line1 = `<div class="recent-top"><span class="tag ${tagClass}">${tagText}</span><span class="mono">${it.time || ""}</span></div>`;
      const line2 = `<div class="recent-body">${it.car} · ${it.driver}${it.spot ? ` · ${it.spot}` : ""}</div>`;
      return `<div class="recent-card">${line1}${line2}</div>`;
    }).join("");
  }

  async function loadLists() {
    const base = DEFAULT_API_URL;
    apiUrlInput && (apiUrlInput.value = base);

    const carsRes = await fetchJSONP(base + "?action=cars");
    const driversRes = await fetchJSONP(base + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(depDriverSelect, driversRes.drivers || [], "출차 운전자 선택");
    fillSelect(arrDriverSelect, driversRes.drivers || [], "입차 운전자 선택");

    // apply URL params (NFC)
    const q = parseQuery();
    if (q.mode === "checkout" || q.mode === "return") setMode(q.mode);
    if (q.car) carSelect.value = q.car;

    // status & recent from cache
    updateStatusUI();
    renderRecent();
  }

  function validateCommon() {
    const car = carSelect.value;
    if (!car) throw new Error("차량을 선택해줘!");
    return { car };
  }

  async function save() {
    if (busy) return;

    showBusy(true, mode === "checkout" ? "출차 저장 중…" : "입차 저장 중…");

    try {
      const { car } = validateCommon();

      if (mode === "checkout") {
        const depDriver = depDriverSelect.value;
        if (!depDriver) throw new Error("출차 운전자를 선택해줘!");
        if (!depManual.value) depManual.value = toDatetimeLocalValue(new Date());
        const depDate = new Date(depManual.value);

        const depTime = toSheetTimeString(depDate);

        await postNoCors({
          mode: "checkout",
          car,
          departureTime: depTime,
          departureDriver: depDriver,
        });

        // cache status
        cache[car] = { state: "미반납", depTime, depDriver };
        writeCache(cache);

        pushRecent({ type: "checkout", car, time: depTime, driver: depDriver });

        // UX: 시간 입력만 비워두기(다음 사용자를 위해)
        // depManual.value = "";

        showToast("출차 저장 완료!", true);
        return;
      }

      // return
      const arrDriver = arrDriverSelect.value;
      if (!arrDriver) throw new Error("입차 운전자를 선택해줘!");
      if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
      const arrDate = new Date(arrManual.value);
      const arrTime = toSheetTimeString(arrDate);

      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");

      await postNoCors({
        mode: "return",
        car,
        arrivalTime: arrTime,
        arrivalDriver: arrDriver,
        parkingSpot: selectedSpot,
      });

      cache[car] = { state: "사용가능", arrTime, arrDriver, spot: selectedSpot };
      writeCache(cache);

      pushRecent({ type: "return", car, time: arrTime, driver: arrDriver, spot: selectedSpot });

      // UX: 입차 후 초기화
      clearSpot();
      // arrManual.value = "";

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

  toggleIntegr && toggleIntegr.addEventListener("click", () => integrPanel.classList.toggle("hidden"));

  saveBtn.addEventListener("click", save);
  refreshRecent && refreshRecent.addEventListener("click", () => {
    // cache 기반이므로 단순 재렌더
    renderRecent();
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
