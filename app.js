const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  running: true,
  mode: "heat",
  chartMode: "entropy",
  input: 80,
  homeostasis: 78,
  speed: 1,
  elapsed: 0,
  lifeS: 2.4,
  objectS: 2.4,
  lifeTotal: 0,
  objectTotal: 0,
  lifeTemp: 36.8,
  objectTemp: 24,
  history: [],
  lastFrame: performance.now(),
};

const els = {
  inputSlider: $("#inputSlider"), inputLabel: $("#inputLabel"), inputValue: $("#inputValue"),
  homeostasisSlider: $("#homeostasisSlider"), homeostasisValue: $("#homeostasisValue"),
  speedSlider: $("#speedSlider"), speedValue: $("#speedValue"), playButton: $("#playButton"), resetButton: $("#resetButton"),
  liveLabel: $("#liveLabel"), elapsedLabel: $("#elapsedLabel"), beamValue: $("#beamValue"),
  exchangeLabel: $("#exchangeLabel"), exchangeSub: $("#exchangeSub"), flowIn: $("#flowIn"), flowOut: $("#flowOut"),
  lifeMetric: $("#lifeMetric"), objectMetric: $("#objectMetric"), totalMetric: $("#totalMetric"),
  lifeDelta: $("#lifeDelta"), objectDelta: $("#objectDelta"), lifeNodeEntropy: $("#lifeNodeEntropy"), objectNodeEntropy: $("#objectNodeEntropy"),
  lifeMeter: $("#lifeMeter"), objectMeter: $("#objectMeter"), lifeTemp: $("#lifeTemp"), objectTemp: $("#objectTemp"),
  lifeTempBar: $("#lifeTempBar"), objectTempBar: $("#objectTempBar"), lifeState: $("#lifeState"), objectState: $("#objectState"),
  chartTitle: $("#chartTitle"), chartEmpty: $("#chartEmpty"), insightText: $("#insightText"), footerTime: $("#footerTime"),
  canvas: $("#liveChart"),
};
const ctx = els.canvas.getContext("2d");

function signed(value, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function entropyFlux() {
  return state.mode === "heat" ? state.input / 310 : state.input;
}

function inputDisplay() {
  return state.mode === "heat" ? `${signed(state.input, 0)} W` : `${signed(state.input, 3)} J/K·s`;
}

function setRangeFill(input, min, max) {
  const percent = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty("--fill", `${percent}%`);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function seedHistory() {
  state.history = [{ t: 0, life: state.lifeS, object: state.objectS, lifeTotal: 2.4, objectTotal: 2.4, lifeTemp: state.lifeTemp, objectTemp: state.objectTemp }];
}

function resetSimulation() {
  state.elapsed = 0; state.lifeS = 2.4; state.objectS = 2.4; state.lifeTotal = 0; state.objectTotal = 0;
  state.lifeTemp = 36.8; state.objectTemp = 24; seedHistory();
  render();
}

function step(dt) {
  const flux = entropyFlux();
  const pressure = Math.abs(flux);
  const homeostasis = state.homeostasis / 100;
  const seconds = dt * state.speed;
  const objectInternalDelta = flux * 0.62 * seconds;
  const objectTotalDelta = (0.018 + pressure * 0.14) * seconds;
  const objectExternalDelta = objectTotalDelta - objectInternalDelta;
  const lifeInternalRate = flux * (0.31 - homeostasis * 0.21) + 0.022 - (state.lifeS - 2.4) * 0.055;
  const lifeInternalDelta = lifeInternalRate * seconds;
  const lifeExternalRate = Math.max(0.012, pressure * (0.45 + homeostasis * 0.4) + 0.018);
  const lifeExternalDelta = lifeExternalRate * seconds;
  const lifeTotalDelta = lifeInternalDelta + lifeExternalDelta;

  state.lifeS += lifeInternalDelta;
  state.objectS += objectInternalDelta;
  state.lifeTotal += lifeTotalDelta;
  state.objectTotal += objectTotalDelta;
  state.elapsed += seconds;

  const thermalForcing = state.mode === "heat" ? state.input : state.input * 180;
  const ambientTarget = 23 + thermalForcing * 0.045;
  const objectTarget = 24 + thermalForcing * 0.055;
  const lifeTarget = 36.8 + thermalForcing * 0.015;
  state.objectTemp += (objectTarget - state.objectTemp) * Math.min(1, 0.12 * seconds);
  state.lifeTemp += (lifeTarget - state.lifeTemp) * Math.min(1, (0.08 + homeostasis * 0.19) * seconds);
  state.history.push({ t: state.elapsed, life: state.lifeS, object: state.objectS, lifeTotal: 2.4 + state.lifeTotal, objectTotal: 2.4 + state.objectTotal, lifeTemp: state.lifeTemp, objectTemp: state.objectTemp });
  if (state.history.length > 3600) state.history.shift();
  state._deltas = { lifeInternalDelta, objectInternalDelta, lifeExternalDelta, objectExternalDelta, lifeExternalRate, flux, ambientTarget };
}

function render() {
  const flux = entropyFlux();
  const d = state._deltas || { lifeInternalDelta: 0, objectInternalDelta: 0, lifeExternalDelta: 0, objectExternalDelta: 0, flux };
  const isHeat = state.mode === "heat";
  els.inputLabel.textContent = isHeat ? "외부 열 유입" : "외부 엔트로피 유입";
  els.inputValue.textContent = inputDisplay();
  els.beamValue.textContent = inputDisplay();
  els.homeostasisValue.textContent = `${state.homeostasis}%`;
  els.speedValue.textContent = `${state.speed.toFixed(2).replace(/\.00$/, "")}×`;
  els.exchangeLabel.textContent = isHeat ? "열 입력" : "엔트로피 입력";
  els.exchangeSub.textContent = state.homeostasis > 60 ? "feedback" : "passive";
  els.flowIn.innerHTML = `${signed(flux, 3)} <small>J/K·s</small>`;
  els.flowOut.innerHTML = `${signed(d.lifeExternalRate ?? 0, 3)} <small>J/K·s</small>`;
  els.lifeMetric.textContent = state.lifeS.toFixed(2);
  els.objectMetric.textContent = state.objectS.toFixed(2);
  els.totalMetric.textContent = signed(state.lifeTotal + state.objectTotal, 2);
  els.lifeDelta.textContent = signed(d.lifeInternalDelta * 10, 2);
  els.objectDelta.textContent = signed(d.objectInternalDelta * 10, 2);
  els.lifeNodeEntropy.textContent = state.lifeS.toFixed(2);
  els.objectNodeEntropy.textContent = state.objectS.toFixed(2);
  els.lifeMeter.style.width = `${Math.max(12, Math.min(94, 48 + (state.lifeS - 2.4) * 38))}%`;
  els.objectMeter.style.width = `${Math.max(12, Math.min(94, 48 + (state.objectS - 2.4) * 26))}%`;
  els.lifeTemp.textContent = `${state.lifeTemp.toFixed(1)}°`;
  els.objectTemp.textContent = `${state.objectTemp.toFixed(1)}°`;
  els.lifeTempBar.style.width = `${Math.max(15, Math.min(95, ((state.lifeTemp - 30) / 15) * 100))}%`;
  els.objectTempBar.style.width = `${Math.max(15, Math.min(95, ((state.objectTemp - 10) / 45) * 100))}%`;
  els.lifeState.textContent = state.homeostasis > 65 ? "조절 중" : "흔들리는 중";
  els.objectState.textContent = state.input < 0 ? "방출 중" : "흡수 중";
  els.liveLabel.textContent = state.running ? "LIVE MODEL" : "PAUSED";
  els.elapsedLabel.textContent = formatTime(state.elapsed);
  els.footerTime.textContent = `${state.elapsed.toFixed(1)} s`;
  els.playButton.innerHTML = state.running ? '<span class="button-icon">Ⅱ</span> 일시정지' : '<span class="button-icon">▶</span> 재생';
  els.chartEmpty.style.opacity = state.history.length ? "0" : ".75";
  els.insightText.textContent = state.homeostasis > 65 ? "항상성이 내부 엔트로피를 완충하고 있습니다." : "항상성이 약해 내부 엔트로피가 더 크게 흔들립니다.";
  updateChart();
}

function resizeCanvas() {
  const rect = els.canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
  els.canvas.width = rect.width * ratio; els.canvas.height = rect.height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); updateChart();
}

function updateChart() {
  const width = els.canvas.clientWidth; const height = els.canvas.clientHeight; if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  const pad = { left: 42, right: 10, top: 12, bottom: 25 }; const chartW = width - pad.left - pad.right; const chartH = height - pad.top - pad.bottom;
  const data = state.history;
  const values = state.chartMode === "entropy" ? data.flatMap(x => [x.life, x.object, x.lifeTotal, x.objectTotal]) : data.flatMap(x => [x.lifeTemp, x.objectTemp]);
  const maxValue = Math.max(0, ...values);
  const min = 0;
  const max = state.chartMode === "entropy" ? Math.max(4.4, Math.ceil(maxValue * 1.15 * 10) / 10) : Math.max(45, Math.ceil(maxValue / 5) * 5);
  const range = max - min || 1;
  const timeMax = Math.max(1, Math.ceil(state.elapsed));
  ctx.font = "9px DM Mono, monospace"; ctx.lineWidth = 1; ctx.fillStyle = "#5f7489";
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH * i / 4;
    ctx.strokeStyle = i === 4 ? "rgba(142, 169, 192, .32)" : "rgba(142, 169, 192, .12)";
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    const tick = max * (1 - i / 4);
    ctx.fillText(state.chartMode === "entropy" ? tick.toFixed(1) : `${tick.toFixed(0)}°`, 7, y + 3);
  }
  ctx.textAlign = "center";
  for (let i = 0; i <= 4; i++) {
    const x = pad.left + chartW * i / 4;
    ctx.strokeStyle = "rgba(142, 169, 192, .08)";
    ctx.beginPath(); ctx.moveTo(x, pad.top); ctx.lineTo(x, pad.top + chartH); ctx.stroke();
    ctx.fillText(`${(timeMax * i / 4).toFixed(timeMax < 10 ? 1 : 0)}s`, x, height - 7);
  }
  ctx.textAlign = "start";
  if (!data.length) return;
  const drawLine = (key, color, dashed = false) => { ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = dashed ? 1 : 2; ctx.setLineDash(dashed ? [4, 5] : []); data.forEach((item, index) => { const x = pad.left + ((item.t || 0) / timeMax) * chartW; const y = pad.top + chartH - ((item[key] - min) / range) * chartH; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]); };
  if (state.chartMode === "entropy") { drawLine("life", "#59d6bf"); drawLine("object", "#f2b85f"); drawLine("lifeTotal", "#a28eff", true); drawLine("objectTotal", "#ef8270", true); } else { drawLine("lifeTemp", "#59d6bf"); drawLine("objectTemp", "#f2b85f"); }
}

function loop(now) {
  const delta = Math.min(.08, (now - state.lastFrame) / 1000); state.lastFrame = now;
  if (state.running) { step(delta); render(); }
  requestAnimationFrame(loop);
}

els.inputSlider.addEventListener("input", (event) => { state.input = Number(event.target.value); setRangeFill(event.target, Number(event.target.min), Number(event.target.max)); render(); });
els.homeostasisSlider.addEventListener("input", (event) => { state.homeostasis = Number(event.target.value); setRangeFill(event.target, 0, 100); render(); });
els.speedSlider.addEventListener("input", (event) => { state.speed = Number(event.target.value); setRangeFill(event.target, .25, 3); render(); });
$$('.segment').forEach(button => button.addEventListener("click", () => { $$('.segment').forEach(item => item.classList.remove("active")); button.classList.add("active"); state.mode = button.dataset.mode; if (state.mode === "heat") { els.inputSlider.min = -80; els.inputSlider.max = 180; els.inputSlider.step = 1; els.inputSlider.value = Math.max(-80, Math.min(180, state.input * 310)); state.input = 80; els.inputSlider.value = 80; } else { els.inputSlider.min = -0.3; els.inputSlider.max = .6; els.inputSlider.step = .001; state.input = .258; els.inputSlider.value = .258; } setRangeFill(els.inputSlider, Number(els.inputSlider.min), Number(els.inputSlider.max)); render(); }));
$$('.chart-mode').forEach(button => button.addEventListener("click", () => { $$('.chart-mode').forEach(item => item.classList.remove("active")); button.classList.add("active"); state.chartMode = button.dataset.chart; els.chartTitle.textContent = state.chartMode === "entropy" ? "엔트로피 상태의 변화" : "열 상태의 변화"; render(); }));
els.playButton.addEventListener("click", () => { state.running = !state.running; render(); });
els.resetButton.addEventListener("click", resetSimulation);
window.addEventListener("resize", resizeCanvas);

seedHistory();
setRangeFill(els.inputSlider, -80, 180); setRangeFill(els.homeostasisSlider, 0, 100); setRangeFill(els.speedSlider, .25, 3); resizeCanvas(); render(); requestAnimationFrame(loop);

