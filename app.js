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
  const saveUrlBtn = $("saveUrlBtn");
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
    toast.textContent = msg;
    toast.style.color = ok ? "#065f46" : "#991b1b";
    setTimeout(() => (toast.textContent = ""), 2500);
  }

  function showSaving(on) {
    savingOverlay.classList.toggle("hidden", !on);
    saveBtn.disabled = on;
    depNow.disabled = on;
    arrNow.disabled = on;
    depManualToggle.disabled = on;
    arrManualToggle.disabled = on;
    spotClear.disabled = on;
    document.querySelectorAll(".spot").forEach((b) => (b.disabled = on));
    saveBtn.textContent = on ? "저장 중…" : "기록 저장";
  }

  function getApiUrl() {
    // ✅ 고정 URL 자동 사용
    return DEFAULT_API_URL;
  }

  function setBadge(connected) {
    statusBadge.className = "badge " + (connected ? "on" : "off");
    statusBadge.textContent = connected ? "자동 연동" : "미연동";
  }

  // datetime-local 형식: YYYY-MM-DDTHH:mm
  function toDatetimeLocalValue(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}-${mm}-${dd}T${hh}:${mi}`;
  }

  // ✅ 시트 저장용 형식: YYYY/MM/DD HH:mm (초/타임존 제거)
  function toSheetTimeString(d) {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function toggleManual(inputEl, btnEl) {
    const willEnable = inputEl.readOnly; // true면 직접입력 켜기
    inputEl.readOnly = !willEnable ? true : false;
    btnEl.classList.toggle("primary", willEnable);
    if (willEnable) inputEl.focus();
  }

  // ✅ JSONP: CORS 우회
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
    const base = getApiUrl();
    setBadge(!!base);

    // 고정 URL 표시 (읽기전용)
    apiUrlInput.value = base;
    saveUrlBtn.disabled = true;

    const carsRes = await fetchJSONP(base + "?action=cars");
    const driversRes = await fetchJSONP(base + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(driverSelect, driversRes.drivers || [], "운전자 선택");
  }

  async function saveLog() {
    if (isSaving) return; // ✅ 중복 클릭 방지
    isSaving = true;
    showSaving(true);

    try {
      const base = getApiUrl();
      if (!base) throw new Error("연동 URL이 없습니다.");

      const car = carSelect.value;
      const driver = driverSelect.value;

      if (!car) throw new Error("차량을 선택해줘!");
      if (!driver) throw new Error("운전자를 선택해줘!");
      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");
      if (!depManual.value) throw new Error("출차시간을 입력해줘!");

      // ✅ 입력칸의 datetime-local 값 → Date로 변환
      const depDate = new Date(depManual.value);
      const arrDate = arrManual.value ? new Date(arrManual.value) : null;

      // ✅ 시트 저장용 문자열(분까지만)
      const departureTime = toSheetTimeString(depDate);
      const arrivalTime = arrDate ? toSheetTimeString(arrDate) : "";

      const payload = {
        car,
        driver,
        departureTime,
        arrivalTime,
        parkingSpot: selectedSpot,
      };

      // ✅ POST는 no-cors로 전송만
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
  depNow.addEventListener("click", () => {
    // ✅ 현재시간 누르면 입력칸에 값이 들어가서 "칸 안에" 보임
    depManual.value = toDatetimeLocalValue(new Date());
  });

  arrNow.addEventListener("click", () => {
    arrManual.value = toDatetimeLocalValue(new Date());
  });

  depManualToggle.addEventListener("click", () => toggleManual(depManual, depManualToggle));
  arrManualToggle.addEventListener("click", () => toggleManual(arrManual, arrManualToggle));

  toggleIntegr.addEventListener("click", () => {
    integrPanel.classList.toggle("hidden");
  });

  saveBtn.addEventListener("click", () => saveLog());

  // boot
  setBadge(true);
  initSpots();
  loadLists().catch((e) => {
    showToast("목록 조회 실패: " + (e && e.message ? e.message : "unknown"), false);
  });
})();
