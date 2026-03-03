(function () {
  const DEFAULT_API_URL =
    "https://script.google.com/macros/s/AKfycbxc1vHrMpPMWKUO5mVSu7PVBm7voHgo5-sX5Me6swdrVQtwIQY6QU3WnS45UXnnALgI/exec";

  const $ = (id) => document.getElementById(id);

  const carSelect = $("carSelect");

  const depDriverSelect = $("depDriverSelect");
  const arrDriverSelect = $("arrDriverSelect");

  const depNow = $("depNow");
  const depManualToggle = $("depManualToggle");
  const depManual = $("depManual");

  const arrNow = $("arrNow");
  const arrManualToggle = $("arrManualToggle");
  const arrManual = $("arrManual");

  const modeCheckoutBtn = $("modeCheckout");
  const modeReturnBtn = $("modeReturn");
  const modeHint = $("modeHint");

  const checkoutSection = $("checkoutSection");
  const returnSection = $("returnSection");

  const saveBtn = $("saveBtn");
  const toast = $("toast");

  const savingOverlay = $("savingOverlay");
  const savingText = $("savingText");

  const spotPreview = $("spotPreview");
  const spotClear = $("spotClear");

  const apiUrlInput = $("apiUrl");
  const toggleIntegr = $("toggleIntegr");
  const integrPanel = $("integrPanel");
  const statusBadge = $("statusBadge");

  let mode = "checkout"; // "checkout" | "return"
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

    document.querySelectorAll("button, select, input").forEach((el) => {
      // overlay를 켠 상태에서도 disabled 토글이 섞여버릴 수 있어서 save/mode만 제한적으로 관리
    });
  }

  function setBadge(connected) {
    statusBadge.className = "badge " + (connected ? "on" : "off");
    statusBadge.textContent = connected ? "자동 연동" : "미연동";
  }

  function setMode(nextMode) {
    mode = nextMode;

    const isCheckout = mode === "checkout";
    modeCheckoutBtn.classList.toggle("primary", isCheckout);
    modeReturnBtn.classList.toggle("primary", !isCheckout);

    // 섹션 토글: class + hidden 속성 2중
    checkoutSection.classList.toggle("hidden", !isCheckout);
    checkoutSection.hidden = !isCheckout;

    returnSection.classList.toggle("hidden", isCheckout);
    returnSection.hidden = isCheckout;

    // 버튼 라벨
    saveBtn.textContent = isCheckout ? "출차 저장" : "입차 저장";
    modeHint.textContent = isCheckout
      ? "출차 등록: 출차시간/출차운전자만 입력"
      : "입차 등록: 입차시간/입차운전자 + 주차위치만 입력";

    // 출차 모드에서는 주차 선택 필요 없음 → 선택 초기화해도 OK
    if (isCheckout) {
      clearSpot();
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

  // ✅ 시트 저장용: YYYY/MM/DD HH:mm
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

  async function loadLists() {
    const base = DEFAULT_API_URL;
    setBadge(!!base);
    if (apiUrlInput) apiUrlInput.value = base;

    const carsRes = await fetchJSONP(base + "?action=cars");
    const driversRes = await fetchJSONP(base + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(depDriverSelect, driversRes.drivers || [], "출차 운전자 선택");
    fillSelect(arrDriverSelect, driversRes.drivers || [], "입차 운전자 선택");
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

    if (spotClear) {
      spotClear.addEventListener("click", () => clearSpot());
    }
  }

  async function postNoCors(payload) {
    await fetch(DEFAULT_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
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

        const payload = {
          mode: "checkout",
          car: car,
          departureTime: toSheetTimeString(depDate),
          departureDriver: depDriver,
        };

        await postNoCors(payload);
        showToast("출차 저장 완료!", true);
        return;
      }

      // return
      const arrDriver = arrDriverSelect.value;
      if (!arrDriver) throw new Error("입차 운전자를 선택해줘!");
      if (!arrManual.value) arrManual.value = toDatetimeLocalValue(new Date());
      const arrDate = new Date(arrManual.value);

      if (!selectedSpot) throw new Error("주차 위치를 선택해줘!");

      const payload = {
        mode: "return",
        car: car,
        arrivalTime: toSheetTimeString(arrDate),
        arrivalDriver: arrDriver,
        parkingSpot: selectedSpot,
      };

      await postNoCors(payload);
      showToast("입차 저장 완료! (미반납 건 자동 업데이트)", true);
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

  toggleIntegr.addEventListener("click", () => integrPanel.classList.toggle("hidden"));
  saveBtn.addEventListener("click", save);

  // boot
  showBusy(false);
  setMode("checkout");
  initSpots();
  loadLists().catch((e) => showToast("목록 조회 실패: " + (e && e.message ? e.message : "unknown"), false));
})();
