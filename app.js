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
  const saveBtn = $("saveBtn");
  const savingOverlay = $("savingOverlay");

  const spotPreview = $("spotPreview");
  const spotClear = $("spotClear");

  let selectedSpot = "";
  let isSaving = false;

  function showToast(msg, ok = true) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.color = ok ? "#065f46" : "#991b1b";
    setTimeout(() => (toast.textContent = ""), 2500);
  }

  function showSaving(on) {
    // ✅ 요소가 없어서 JS가 죽는 경우 방지
    if (savingOverlay) savingOverlay.classList.toggle("hidden", !on);

    // 버튼/입력 잠금
    if (saveBtn) saveBtn.disabled = on;
    if (depNow) depNow.disabled = on;
    if (arrNow) arrNow.disabled = on;
    if (depManualToggle) depManualToggle.disabled = on;
    if (arrManualToggle) arrManualToggle.disabled = on;
    if (spotClear) spotClear.disabled = on;
    document.querySelectorAll(".spot").forEach((b) => (b.disabled = on));

    if (saveBtn) saveBtn.textContent = on ? "저장 중…" : "기록 저장";
  }

  function getApiUrl() {
    return DEFAULT_API_URL;
  }

  function setBadge(connected) {
    if (!statusBadge) return;
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

  async function loadLists() {
    const base = getApiUrl();
    setBadge(!!base);

    if (apiUrlInput) apiUrlInput.value = base;

    const carsRes = await fetchJSONP(base + "?action=cars");
    const driversRes = await fetchJSONP(base + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(driverSelect, driversRes.drivers || [], "운전자 선택");
  }

  async function saveLog() {
    if (isSaving) return;
    isSaving = true;
    showSaving(true);

    try {
      const base = getApiUrl();
      const car = carSelect ? carSelect.value : "";
      const driver = driverSelect ? driverSelect.value : "";

      if (!car) throw new Error("차량을 선택해줘!");
      if (!driver) throw new Error("운전자를 선택해줘!");
      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");
      if (!depManual || !depManual.value) throw new Error("출차시간을 입력해줘!");

      const depDate = new Date(depManual.value);
      const arrDate = (arrManual && arrManual.value) ? new Date(arrManual.value) : null;

      const payload = {
        car,
        driver,
        departureTime: toSheetTimeString(depDate),
        arrivalTime: arrDate ? toSheetTimeString(arrDate) : "",
        parkingSpot: selectedSpot,
      };

      await fetch(base, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      showToast("저장 완료! (시트에서 확인)", true);
    } catch (e) {
      showToast(e && e.message ? e.message : "저장 실패", false);
    } finally {
      showSaving(false);
      isSaving = false;
    }
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

    if (spotClear) {
      spotClear.addEventListener("click", () => {
        selectedSpot = "";
        document.querySelectorAll(".spot").forEach((b) => b.classList.remove("selected"));
        if (spotPreview) spotPreview.textContent = "선택된 위치: 없음";
      });
    }
  }

  // events
  if (depNow) depNow.addEventListener("click", () => (depManual.value = toDatetimeLocalValue(new Date())));
  if (arrNow) arrNow.addEventListener("click", () => (arrManual.value = toDatetimeLocalValue(new Date())));

  if (depManualToggle) depManualToggle.addEventListener("click", () => toggleManual(depManual, depManualToggle));
  if (arrManualToggle) arrManualToggle.addEventListener("click", () => toggleManual(arrManual, arrManualToggle));

  if (toggleIntegr) toggleIntegr.addEventListener("click", () => integrPanel.classList.toggle("hidden"));
  if (saveBtn) saveBtn.addEventListener("click", () => saveLog());

  // boot
  showSaving(false); // ✅ 접속 즉시 저장 오버레이 강제 OFF
  setBadge(true);
  initSpots();
  loadLists().catch((e) => showToast("목록 조회 실패: " + (e && e.message ? e.message : "unknown"), false));
})();
