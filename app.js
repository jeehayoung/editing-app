(function () {
  const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbxc1vHrMpPMWKUO5mVSu7PVBm7voHgo5-sX5Me6swdrVQtwIQY6QU3WnS45UXnnALgI/exec";

  const $ = (id) => document.getElementById(id);

  const carSelect = $("carSelect");
  const driverSelect = $("driverSelect");

  const depNow = $("depNow");
  const arrNow = $("arrNow");
  const depManualToggle = $("depManualToggle");
  const arrManualToggle = $("arrManualToggle");
  const depManual = $("depManual");
  const arrManual = $("arrManual");

  const apiUrlInput = $("apiUrl");
  const toggleIntegr = $("toggleIntegr");
  const integrPanel = $("integrPanel");
  const statusBadge = $("statusBadge");

  const toast = $("toast");
  const checkoutBtn = $("checkoutBtn");
  const returnBtn = $("returnBtn");
  const savingOverlay = $("savingOverlay");
  const savingText = $("savingText");

  const spotPreview = $("spotPreview");
  const spotClear = $("spotClear");

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

    if (checkoutBtn) checkoutBtn.disabled = on;
    if (returnBtn) returnBtn.disabled = on;
    if (depNow) depNow.disabled = on;
    if (arrNow) arrNow.disabled = on;
    if (depManualToggle) depManualToggle.disabled = on;
    if (arrManualToggle) arrManualToggle.disabled = on;
    if (spotClear) spotClear.disabled = on;
    document.querySelectorAll(".spot").forEach((b) => (b.disabled = on));
  }

  function setBadge(connected) {
    statusBadge.className = "badge " + (connected ? "on" : "off");
    statusBadge.textContent = connected ? "자동 연동" : "미연동";
  }

  function toDatetimeLocalValue(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd}T${hh}:${mi}`;
  }

  // ✅ 시트 저장용: YYYY/MM/DD HH:mm (분까지만)
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

  // JSONP (CORS 회피)
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

  async function loadLists() {
    const base = DEFAULT_API_URL;
    setBadge(!!base);
    if (apiUrlInput) apiUrlInput.value = base;

    const carsRes = await fetchJSONP(base + "?action=cars");
    const driversRes = await fetchJSONP(base + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(driverSelect, driversRes.drivers || [], "운전자 선택");
  }

  function requireCommon() {
    const car = carSelect.value;
    const driver = driverSelect.value;

    if (!car) throw new Error("차량을 선택해줘!");
    if (!driver) throw new Error("운전자를 선택해줘!");
    if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");

    return { car, driver };
  }

  async function postNoCors(payload) {
    // POST는 no-cors로 “전송만” (응답 못 읽어도 시트에는 저장/업데이트됨)
    await fetch(DEFAULT_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  }

  async function checkout() {
    if (busy) return;
    showBusy(true, "출차 저장 중…");

    try {
      const { car, driver } = requireCommon();

      // 출차시간 없으면 지금으로
      if (!depManual.value) depManual.value = toDatetimeLocalValue(new Date());
      const depDate = new Date(depManual.value);

      const payload = {
        mode: "checkout",
        car,
        driver,
        departureTime: toSheetTimeString(depDate),
        parkingSpot: selectedSpot,
      };

      await postNoCors(payload);

      showToast("출차 저장 완료!", true);

      // UX: 출차 저장 후 입차칸은 비워두고, 입차는 나중에 누르게
      // (원하면 여기서 depManual은 유지/초기화 옵션도 가능)
    } catch (e) {
      showToast(e.message || "출차 저장 실패", false);
    } finally {
      showBusy(false);
    }
  }

  async function returnCar() {
    if (busy) return;
    showBusy(true, "입차 저장 중…");

    try {
      const { car, driver } = requireCommon();

      // 입차시간 없으면 지금으로
      if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
      const arrDate = new Date(arrManual.value);

      const payload = {
        mode: "return",
        car,
        driver,
        arrivalTime: toSheetTimeString(arrDate),
        parkingSpot: selectedSpot,
      };

      await postNoCors(payload);

      showToast("입차 저장 완료! (미반납 건 자동 업데이트)", true);

      // UX: 입차 저장 후 시간칸 초기화(선택)
      // arrManual.value = "";
      // selectedSpot = ""; ...
    } catch (e) {
      showToast(e.message || "입차 저장 실패", false);
    } finally {
      showBusy(false);
    }
  }

  function initSpots() {
    document.querySelectorAll(".spot").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".spot").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedSpot = btn.dataset.spot;
        spotPreview.textContent = "선택된 위치: " + selectedSpot;
      });
    });

    spotClear.addEventListener("click", () => {
      selectedSpot = "";
      document.querySelectorAll(".spot").forEach((b) => b.classList.remove("selected"));
      spotPreview.textContent = "선택된 위치: 없음";
    });
  }

  // events
  depNow.addEventListener("click", () => (depManual.value = toDatetimeLocalValue(new Date())));
  arrNow.addEventListener("click", () => (arrManual.value = toDatetimeLocalValue(new Date())));

  depManualToggle.addEventListener("click", () => toggleManual(depManual, depManualToggle));
  arrManualToggle.addEventListener("click", () => toggleManual(arrManual, arrManualToggle));

  toggleIntegr.addEventListener("click", () => integrPanel.classList.toggle("hidden"));

  checkoutBtn.addEventListener("click", checkout);
  returnBtn.addEventListener("click", returnCar);

  // boot
  showBusy(false);
  initSpots();
  loadLists().catch((e) => showToast("목록 조회 실패: " + (e && e.message ? e.message : "unknown"), false));
})();
