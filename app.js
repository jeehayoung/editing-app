(function () {
  const $ = (id) => document.getElementById(id);

  const carSelect = $("carSelect");
  const driverSelect = $("driverSelect");

  const depNow = $("depNow");
  const arrNow = $("arrNow");
  const depManualToggle = $("depManualToggle");
  const arrManualToggle = $("arrManualToggle");
  const depManual = $("depManual");
  const arrManual = $("arrManual");
  const depPreview = $("depPreview");
  const arrPreview = $("arrPreview");

  const apiUrlInput = $("apiUrl");
  const saveUrlBtn = $("saveUrlBtn");
  const toggleIntegr = $("toggleIntegr");
  const integrPanel = $("integrPanel");
  const statusBadge = $("statusBadge");

  const toast = $("toast");
  const saveBtn = $("saveBtn");

  const spotPreview = $("spotPreview");
  const spotClear = $("spotClear");

  let selectedSpot = "";
  let departureTime = "";
  let arrivalTime = "";

  function showToast(msg, ok = true) {
    toast.textContent = msg;
    toast.style.color = ok ? "#065f46" : "#991b1b";
    setTimeout(() => (toast.textContent = ""), 2500);
  }

  function getApiUrl() {
    return (localStorage.getItem("apps_script_url") || "").trim();
  }

  function setBadge(connected) {
    statusBadge.className = "badge " + (connected ? "on" : "off");
    statusBadge.textContent = connected ? "연동됨" : "미연동";
  }

  function fmtKorean(d) {
    const yy = d.getFullYear();
    const mm = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yy}. ${mm}. ${dd}. ${hh}시 ${mi}분 ${ss}초`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function setDeparture(iso) {
    departureTime = iso;
    depPreview.textContent = "선택값: " + fmtKorean(new Date(iso));
  }

  function setArrival(iso) {
    arrivalTime = iso;
    arrPreview.textContent = "선택값: " + fmtKorean(new Date(iso));
  }

  function toggleManual(inputEl, btnEl) {
    const willEnable = inputEl.disabled; // true면 켜는 상태
    inputEl.disabled = !willEnable ? true : false;
    btnEl.classList.toggle("primary", willEnable);
    if (willEnable) inputEl.focus();
  }

  // ✅ JSONP: CORS 우회 (script tag로 불러옴)
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
    if (!base) {
      setBadge(false);
      fillSelect(carSelect, [], "연동 URL 저장 후 차량 조회");
      fillSelect(driverSelect, [], "연동 URL 저장 후 운전자 조회");
      return;
    }

    setBadge(true);

    // ✅ GET은 JSONP로 호출 (CORS 회피)
    const carsRes = await fetchJSONP(base + "?action=cars");
    const driversRes = await fetchJSONP(base + "?action=drivers");

    fillSelect(carSelect, carsRes.cars || [], "차량 선택");
    fillSelect(driverSelect, driversRes.drivers || [], "운전자 선택");
  }

  async function saveLog() {
    const base = getApiUrl();
    if (!base) return showToast("연동 URL을 먼저 저장해줘!", false);

    const car = carSelect.value;
    const driver = driverSelect.value;

    // manual inputs override if enabled and filled
    if (!depManual.disabled && depManual.value) {
      departureTime = new Date(depManual.value).toISOString();
      setDeparture(departureTime);
    }
    if (!arrManual.disabled && arrManual.value) {
      arrivalTime = new Date(arrManual.value).toISOString();
      setArrival(arrivalTime);
    }

    if (!car) return showToast("차량을 선택해줘!", false);
    if (!driver) return showToast("운전자를 선택해줘!", false);
    if (!departureTime) return showToast("출차시간을 입력해줘!", false);
    if (!selectedSpot) return showToast("주차 위치를 선택해줘!", false);

    const payload = {
      car,
      driver,
      departureTime,
      arrivalTime,
      parkingSpot: selectedSpot,
    };

    // ✅ POST는 no-cors로 "전송"만 (브라우저가 응답을 막을 수 있어서)
    try {
      await fetch(base, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      showToast("저장 요청 전송 완료! (시트에서 저장 여부 확인)", true);
    } catch (e) {
      showToast("저장 전송 실패: " + (e && e.message ? e.message : "unknown"), false);
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
  depNow.addEventListener("click", () => setDeparture(nowISO()));
  arrNow.addEventListener("click", () => setArrival(nowISO()));
  depManualToggle.addEventListener("click", () => toggleManual(depManual, depManualToggle));
  arrManualToggle.addEventListener("click", () => toggleManual(arrManual, arrManualToggle));

  toggleIntegr.addEventListener("click", () => {
    integrPanel.classList.toggle("hidden");
  });

  saveUrlBtn.addEventListener("click", async () => {
    const v = (apiUrlInput.value || "").trim();
    if (!v) return showToast("URL을 입력해줘!", false);
    localStorage.setItem("apps_script_url", v);
    showToast("연동 URL 저장 완료!", true);

    try {
      await loadLists();
    } catch (e) {
      showToast("목록 조회 실패: " + (e && e.message ? e.message : "unknown"), false);
    }
  });

  saveBtn.addEventListener("click", () => saveLog());

  // boot
  apiUrlInput.value = getApiUrl();
  setBadge(!!getApiUrl());
  initSpots();
  loadLists().catch(() => {});
})();
