/**
 * 训练行情：Canvas K 线 / 分时图。
 */

const MA_WINDOWS = [5, 10, 20];
const MA_COLORS = { 5: "#f5c542", 10: "#4dabf7", 20: "#b197fc" };

function niceScale(min, max, target = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 0.5;
    min -= pad;
    max += pad;
  }
  const range = max - min;
  const rough = range / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  const factor = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  const step = factor * magnitude;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = lo; value <= hi + step * 1e-6; value += step) ticks.push(Number(value.toFixed(10)));
  return { lo, hi, step, ticks };
}

function decimalsFor(step) {
  if (!Number.isFinite(step) || step <= 0) return 2;
  return Math.min(6, Math.max(0, -Math.floor(Math.log10(step))));
}

function movingAverage(values, window) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= window) sum -= values[index - window];
    if (index >= window - 1) out[index] = sum / window;
  }
  return out;
}

export class KlineChart {
  constructor(canvas, tooltip) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tooltip = tooltip;
    this.payload = null;
    this.rows = [];
    this.mas = {};
    this.view = { end: null, count: 180 };
    this.hover = -1;
    this.mouse = { x: 0, y: 0 };
    this.dragging = false;
    this.dragStart = { x: 0, end: 0, count: 0 };
    this.cn = true;
    this.onHover = null;
    this.width = 0;
    this.height = 0;
    this.padding = { left: 10, right: 68, top: 20, bottom: 24 };
    this.bind();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement);
    this.resize();
  }

  get colors() {
    return this.cn
      ? { up: "#ff4d4f", down: "#12b886", upFill: "rgba(255,77,79,0.75)", downFill: "rgba(18,184,134,0.75)" }
      : { up: "#12b886", down: "#ff4d4f", upFill: "rgba(18,184,134,0.75)", downFill: "rgba(255,77,79,0.75)" };
  }

  setColorMode(cn) {
    this.cn = cn;
    this.draw();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  setData(payload) {
    const previousLength = this.rows.length;
    this.payload = payload;
    const isLine = payload.mode === "line";
    this.rows = isLine ? payload.line : payload.candles;
    if (!isLine) {
      const closes = this.rows.map((row) => row.c);
      this.mas = {};
      for (const window of MA_WINDOWS) this.mas[window] = movingAverage(closes, window);
    } else {
      this.mas = {};
    }
    const length = this.rows.length;
    const modeChanged = this.lastMode !== payload.mode;
    this.lastMode = payload.mode;
    const pinned = this.view.end === null || this.view.end >= previousLength;
    if (modeChanged) {
      this.view.count = isLine ? Math.max(12, length) : Math.min(180, Math.max(12, length));
      this.view.end = length;
    } else if (this.view.end === null) {
      this.view.count = Math.min(180, Math.max(12, length));
    } else if (pinned) {
      this.view.end = length;
    }
    this.view.count = Math.min(this.view.count, Math.max(length, 1));
    this.view.end = Math.min(Math.max(this.view.end ?? length, Math.min(this.view.count, length)), length);
    if (this.hover >= length) this.hover = -1;
    this.draw();
  }

  resetView() {
    const length = this.rows.length;
    this.view.count = Math.min(180, Math.max(12, length));
    this.view.end = length;
    this.draw();
  }

  viewRange() {
    const length = this.rows.length;
    const count = Math.min(this.view.count, length);
    const end = Math.min(this.view.end ?? length, length);
    return { start: Math.max(0, end - count), end, count };
  }

  bind() {
    const canvas = this.canvas;
    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      if (this.dragging) {
        const { slot } = this.geometry();
        const shift = Math.round((this.dragStart.x - this.mouse.x) / Math.max(slot, 1));
        this.view.end = this.clampEnd(this.dragStart.end + shift);
        this.view.count = this.dragStart.count;
        this.draw();
        return;
      }
      this.hover = this.indexAt(this.mouse.x);
      this.draw();
      if (this.onHover) this.onHover(this.hover, this.mouse);
    });
    canvas.addEventListener("mouseleave", () => {
      this.hover = -1;
      this.mouse = { x: -1, y: -1 };
      this.dragging = false;
      canvas.classList.remove("dragging");
      this.draw();
      if (this.onHover) this.onHover(-1, null);
    });
    canvas.addEventListener("mousedown", (event) => {
      event.preventDefault();
      this.dragging = true;
      canvas.classList.add("dragging");
      this.dragStart = { x: event.clientX - canvas.getBoundingClientRect().left, end: this.view.end ?? this.rows.length, count: this.view.count };
    });
    window.addEventListener("mouseup", () => {
      this.dragging = false;
      canvas.classList.remove("dragging");
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const length = this.rows.length;
      if (!length) return;
      const { plotX, plotWidth } = this.geometry();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const fraction = Math.min(1, Math.max(0, (x - plotX) / plotWidth));
      const range = this.viewRange();
      const anchor = range.start + fraction * range.count;
      const factor = event.deltaY > 0 ? 1.18 : 1 / 1.18;
      const next = Math.min(length, Math.max(8, Math.round(range.count * factor)));
      let end = Math.round(anchor + (1 - fraction) * next);
      this.view.count = next;
      this.view.end = this.clampEnd(end);
      this.hover = this.indexAt(x);
      this.draw();
      if (this.onHover) this.onHover(this.hover, this.mouse);
    }, { passive: false });
    canvas.addEventListener("dblclick", () => this.resetView());
  }

  clampEnd(end) {
    const length = this.rows.length;
    return Math.min(length, Math.max(Math.min(this.view.count, length), end));
  }

  geometry() {
    const volumeHeight = this.payload && this.payload.mode === "candle" ? Math.max(46, this.height * 0.19) : 0;
    const { left, right, top, bottom } = this.padding;
    const mainBottom = this.height - bottom - (volumeHeight ? volumeHeight + 16 : 0);
    return {
      plotX: left,
      plotWidth: Math.max(10, this.width - left - right),
      plotY: top,
      plotHeight: Math.max(10, mainBottom - top),
      volumeY: mainBottom + 16,
      volumeHeight,
      slot: Math.max(0.01, (this.width - left - right) / Math.max(1, this.viewRange().count)),
    };
  }

  indexAt(x) {
    const { plotX, plotWidth } = this.geometry();
    const range = this.viewRange();
    if (x < plotX - 4 || x > plotX + plotWidth + 4) return -1;
    const fraction = (x - plotX) / plotWidth;
    return Math.min(range.end - 1, range.start + Math.floor(fraction * range.count));
  }

  draw() {
    const ctx = this.ctx;
    const { width, height } = this;
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#080b10";
    ctx.fillRect(0, 0, width, height);
    if (!this.rows.length) {
      ctx.fillStyle = "#4b5768";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("暂无数据", width / 2, height / 2);
      return;
    }
    const isLine = this.payload.mode === "line";
    if (isLine) this.drawLine();
    else this.drawCandles();
  }

  visibleBounds() {
    const range = this.viewRange();
    const rows = this.rows.slice(range.start, range.end);
    let min;
    let max;
    if (this.payload.mode === "line") {
      min = Infinity;
      max = -Infinity;
      for (const row of rows) {
        min = Math.min(min, row[1]);
        max = Math.max(max, row[1]);
      }
    } else {
      min = Infinity;
      max = -Infinity;
      for (const row of rows) {
        min = Math.min(min, row.l);
        max = Math.max(max, row.h);
      }
      for (const window of MA_WINDOWS) {
        const series = this.mas[window];
        for (let index = range.start; index < range.end; index += 1) {
          const value = series[index];
          if (value === null || value === undefined) continue;
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0;
      max = 1;
    }
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.02 || 0.5;
    return niceScale(min - pad, max + pad, 5);
  }

  drawGrid(scale, geometry, range) {
    const ctx = this.ctx;
    const { plotX, plotWidth, plotY, plotHeight } = geometry;
    const chartBottom = geometry.volumeHeight ? geometry.volumeY + geometry.volumeHeight : plotY + plotHeight;
    ctx.save();
    ctx.strokeStyle = "#161d27";
    ctx.lineWidth = 1;
    ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    const decimals = decimalsFor(scale.step);
    for (const tick of scale.ticks) {
      if (tick < scale.lo - 1e-9 || tick > scale.hi + 1e-9) continue;
      const y = plotY + plotHeight - ((tick - scale.lo) / (scale.hi - scale.lo)) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(plotX, Math.round(y) + 0.5);
      ctx.lineTo(plotX + plotWidth, Math.round(y) + 0.5);
      ctx.stroke();
      const label = this.formatAxis(tick, decimals);
      const labelWidth = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(8,11,16,0.86)";
      ctx.fillRect(plotX + 2, y - 14, labelWidth + 5, 13);
      ctx.fillStyle = "#5d6a7d";
      ctx.fillText(label, plotX + 4, y - 3);
    }
    const columns = Math.min(8, Math.max(3, Math.floor(plotWidth / 120)));
    const stepIndex = Math.max(1, Math.ceil(range.count / columns));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const lastIndex = range.end - 1;
    const marks = [];
    for (let index = range.start; index < range.end; index += stepIndex) marks.push(index);
    if (marks.length && lastIndex - marks[marks.length - 1] > stepIndex * 0.55) marks.push(lastIndex);
    for (const index of marks) {
      const fraction = (index - range.start + 0.5) / range.count;
      const x = plotX + fraction * plotWidth;
      ctx.strokeStyle = "#121821";
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, plotY);
      ctx.lineTo(Math.round(x) + 0.5, chartBottom);
      ctx.stroke();
      const row = this.rows[index];
      const label = this.payload.mode === "line" ? row[0] : row.s;
      ctx.fillStyle = "#54606f";
      ctx.fillText(String(label), x, chartBottom + 7);
    }
    ctx.restore();
  }

  formatAxis(value, decimals) {
    if (Math.abs(value) >= 100000) return `${(value / 1000).toFixed(0)}k`;
    if (Math.abs(value) >= 10000) return `${(value / 1000).toFixed(1)}k`;
    return value.toFixed(decimals);
  }

  drawCandles() {
    const ctx = this.ctx;
    const geometry = this.geometry();
    const { plotX, plotWidth, plotY, plotHeight, volumeY, volumeHeight, slot } = geometry;
    const range = this.viewRange();
    const scale = this.visibleBounds();
    const yOf = (value) => plotY + plotHeight - ((value - scale.lo) / (scale.hi - scale.lo)) * plotHeight;
    this.drawGrid(scale, geometry, range);

    const colors = this.colors;
    const bodyWidth = Math.min(13, Math.max(1, slot * 0.62));
    const rows = this.rows;
    for (let index = range.start; index < range.end; index += 1) {
      const row = rows[index];
      const x = plotX + (index - range.start + 0.5) * slot;
      const up = row.c >= row.o;
      const color = up ? colors.up : colors.down;
      ctx.strokeStyle = color;
      ctx.fillStyle = up ? colors.upFill : colors.downFill;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const highY = Math.round(yOf(row.h)) + 0.5;
      const lowY = Math.round(yOf(row.l)) + 0.5;
      ctx.moveTo(Math.round(x) + 0.5, highY);
      ctx.lineTo(Math.round(x) + 0.5, lowY);
      ctx.stroke();
      const openY = yOf(row.o);
      const closeY = yOf(row.c);
      const top = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));
      if (bodyWidth <= 1.6) {
        ctx.fillRect(Math.round(x), top, 1, bodyHeight);
      } else {
        ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, bodyHeight);
      }
    }

    // 均线
    ctx.save();
    ctx.beginPath();
    ctx.rect(plotX, plotY, plotWidth, plotHeight);
    ctx.clip();
    for (const window of MA_WINDOWS) {
      const series = this.mas[window];
      if (!series) continue;
      ctx.strokeStyle = MA_COLORS[window];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let started = false;
      for (let index = range.start; index < range.end; index += 1) {
        const value = series[index];
        if (value === null || value === undefined) {
          started = false;
          continue;
        }
        const x = plotX + (index - range.start + 0.5) * slot;
        const y = yOf(value);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    this.drawMaLegend(range, plotX, plotY, colors);
    const lastRow = rows[range.end - 1];
    this.drawLastPrice(lastRow.c, yOf, geometry, lastRow.c >= lastRow.o);

    // 成交量（采样速率）
    const rates = rows.slice(range.start, range.end).map((row) => row.thr || 0);
    const maxRate = Math.max(1e-6, ...rates);
    ctx.fillStyle = "#5d6a7d";
    ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("采样速率 点/分", plotX + 4, volumeY + 11);
    for (let index = range.start; index < range.end; index += 1) {
      const row = rows[index];
      const x = plotX + (index - range.start + 0.5) * slot;
      const height = Math.max(1, Math.sqrt((row.thr || 0) / maxRate) * (volumeHeight - 4));
      const up = row.c >= row.o;
      ctx.fillStyle = up ? "rgba(255,77,79,0.55)" : "rgba(18,184,134,0.55)";
      if (!this.cn) ctx.fillStyle = up ? "rgba(18,184,134,0.55)" : "rgba(255,77,79,0.55)";
      const width = Math.max(1, Math.min(11, slot * 0.62));
      ctx.fillRect(x - width / 2, volumeY + volumeHeight - height, width, height);
    }
    ctx.strokeStyle = "#161d27";
    ctx.beginPath();
    ctx.moveTo(plotX, volumeY + volumeHeight + 0.5);
    ctx.lineTo(plotX + plotWidth, volumeY + volumeHeight + 0.5);
    ctx.stroke();

    if (this.hover >= range.start && this.hover < range.end) {
      this.drawCrosshair(geometry, range, yOf(rows[this.hover].c));
    }
  }

  drawMaLegend(range, x, y, colors) {
    if (!this.mas[5]) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let cursor = x + 4;
    for (const window of MA_WINDOWS) {
      const series = this.mas[window];
      const value = series ? series[Math.min(range.end - 1, this.rows.length - 1)] : null;
      if (value === null || value === undefined) continue;
      ctx.fillStyle = MA_COLORS[window];
      const text = `MA${window} ${this.formatAxis(value, 3)}`;
      ctx.fillText(text, cursor, y + 2);
      cursor += ctx.measureText(text).width + 12;
    }
    ctx.restore();
  }

  drawLastPrice(price, yOf, geometry, rising) {
    const ctx = this.ctx;
    const { plotX, plotWidth } = geometry;
    const y = Math.round(yOf(price)) + 0.5;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = rising ? "rgba(255,77,79,0.5)" : "rgba(18,184,134,0.5)";
    if (!this.cn) ctx.strokeStyle = rising ? "rgba(18,184,134,0.5)" : "rgba(255,77,79,0.5)";
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotWidth, y);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = price.toFixed(Math.abs(price) < 1 ? 4 : 3);
    ctx.font = "11px 'JetBrains Mono', ui-monospace, monospace";
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = (rising === this.cn) ? "#c03336" : "#0b8f6a";
    ctx.fillRect(plotX + plotWidth + 2, y - 9, textWidth + 10, 18);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, plotX + plotWidth + 7 + textWidth / 2, y);
    ctx.restore();
  }

  drawLine() {
    const ctx = this.ctx;
    const geometry = this.geometry();
    const { plotX, plotWidth, plotY, plotHeight, slot } = geometry;
    const range = this.viewRange();
    const scale = this.visibleBounds();
    const yOf = (value) => plotY + plotHeight - ((value - scale.lo) / (scale.hi - scale.lo)) * plotHeight;
    this.drawGrid(scale, geometry, range);
    const rows = this.rows.slice(range.start, range.end);
    const gradient = ctx.createLinearGradient(0, plotY, 0, plotY + plotHeight);
    gradient.addColorStop(0, "rgba(77,171,247,0.24)");
    gradient.addColorStop(1, "rgba(77,171,247,0.01)");
    ctx.beginPath();
    rows.forEach((row, index) => {
      const x = plotX + (index + 0.5) * slot;
      const y = yOf(row[1]);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.save();
    ctx.strokeStyle = "#4dabf7";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.lineTo(plotX + plotWidth, plotY + plotHeight);
    ctx.lineTo(plotX, plotY + plotHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
    const last = rows[rows.length - 1];
    const previous = rows.length > 1 ? rows[rows.length - 2][1] : last[1];
    this.drawLastPrice(last[1], yOf, geometry, last[1] >= previous);
    if (this.hover >= range.start && this.hover < range.end) {
      this.drawCrosshair(geometry, range, yOf(this.rows[this.hover][1]));
    }
  }

  drawCrosshair(geometry, range, y) {
    const ctx = this.ctx;
    const { plotX, plotWidth, plotY, plotHeight } = geometry;
    const index = this.hover;
    const x = plotX + (index - range.start + 0.5) * geometry.slot;
    const chartBottom = geometry.volumeHeight ? geometry.volumeY + geometry.volumeHeight : plotY + plotHeight;
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "rgba(160,174,192,0.42)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, plotY);
    ctx.lineTo(Math.round(x) + 0.5, chartBottom);
    ctx.moveTo(plotX, Math.round(y) + 0.5);
    ctx.lineTo(plotX + plotWidth, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#d8e2ee";
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  hoveredRow() {
    if (this.hover < 0 || this.hover >= this.rows.length) return null;
    return { row: this.rows[this.hover], index: this.hover };
  }
}
