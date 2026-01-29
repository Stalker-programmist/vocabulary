import { apiRequest } from "./api.js";
import { setStatus } from "./utils.js";

const COLORS = {
  words: "#ff6b35",
  reviews: "#3fb8a6",
  grid: "rgba(15, 31, 36, 0.08)",
  axis: "rgba(15, 31, 36, 0.6)",
};

let chartReady = false;

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return { ctx, width: rect.width, height: rect.height };
}

function drawGrid(ctx, width, height, padding, maxValue) {
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  const steps = 4;
  for (let i = 0; i <= steps; i += 1) {
    const y = padding.top + ((height - padding.top - padding.bottom) * i) / steps;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = COLORS.axis;
  ctx.font = "12px Space Grotesk, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= steps; i += 1) {
    const value = Math.round((maxValue * (steps - i)) / steps);
    const y = padding.top + ((height - padding.top - padding.bottom) * i) / steps;
    ctx.fillText(value.toString(), padding.left - 8, y);
  }
}

function drawBars(ctx, data, width, height, padding) {
  const maxValue = Math.max(1, ...data.new_words, ...data.reviews);
  drawGrid(ctx, width, height, padding, maxValue);

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const count = data.labels.length;
  const groupWidth = chartWidth / count;
  const barWidth = Math.max(6, groupWidth * 0.35);
  const gap = Math.max(2, groupWidth * 0.1);

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "11px Space Grotesk, sans-serif";
  ctx.fillStyle = COLORS.axis;

  for (let i = 0; i < count; i += 1) {
    const xCenter = padding.left + groupWidth * i + groupWidth / 2;
    const wordHeight = (data.new_words[i] / maxValue) * chartHeight;
    const reviewHeight = (data.reviews[i] / maxValue) * chartHeight;

    ctx.fillStyle = COLORS.words;
    ctx.fillRect(
      xCenter - barWidth - gap / 2,
      padding.top + chartHeight - wordHeight,
      barWidth,
      wordHeight
    );

    ctx.fillStyle = COLORS.reviews;
    ctx.fillRect(
      xCenter + gap / 2,
      padding.top + chartHeight - reviewHeight,
      barWidth,
      reviewHeight
    );

    if (count <= 12 || i % Math.ceil(count / 10) === 0 || i === count - 1) {
      ctx.fillStyle = COLORS.axis;
      ctx.fillText(
        data.labels[i],
        xCenter,
        padding.top + chartHeight + 6
      );
    }
  }

  return {
    maxValue,
    groupWidth,
    barWidth,
    gap,
    chartHeight,
    padding,
  };
}

function formatTooltip(label, words, reviews) {
  return `${label}\nНовые: ${words}\nПовторы: ${reviews}`;
}

function updateTooltip(tooltip, content, x, y) {
  if (!tooltip) return;
  tooltip.textContent = content;
  tooltip.style.transform = `translate(${x}px, ${y}px)`;
  tooltip.dataset.visible = "true";
}

function hideTooltip(tooltip) {
  if (!tooltip) return;
  tooltip.dataset.visible = "false";
}

export function initStatsChart({ elements }) {
  const canvas = elements.statsChart;
  if (!canvas) return;
  if (chartReady) return;
  chartReady = true;
  const tooltip = elements.statsTooltip;
  let currentRange = "7d";
  let latestData = null;
  let chartMeta = null;

  async function load(range) {
    currentRange = range;
    if (elements.statsChartStatus) {
      setStatus(elements.statsChartStatus, "Loading...");
    }
    try {
      const data = await apiRequest(`/api/stats/series?range=${range}`);
      latestData = data;
      redraw();
      if (elements.statsChartStatus) {
        setStatus(elements.statsChartStatus, "");
      }
    } catch (err) {
      if (elements.statsChartStatus) {
        setStatus(elements.statsChartStatus, err.message || "Chart failed");
      }
    }
  }

  function redraw() {
    if (!latestData) return;
    const { ctx, width, height } = setupCanvas(canvas);
    ctx.clearRect(0, 0, width, height);
    const padding = { top: 20, right: 16, bottom: 28, left: 42 };
    chartMeta = drawBars(ctx, latestData, width, height, padding);
    canvas.dataset.range = currentRange;
  }

  function onMove(event) {
    if (!latestData || !chartMeta) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const { groupWidth, padding } = chartMeta;
    const index = Math.floor(
      (x - padding.left) / groupWidth
    );
    if (index < 0 || index >= latestData.labels.length) {
      hideTooltip(tooltip);
      return;
    }
    const label = latestData.labels[index];
    const words = latestData.new_words[index];
    const reviews = latestData.reviews[index];
    updateTooltip(tooltip, formatTooltip(label, words, reviews), x, 8);
  }

  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("mouseleave", () => hideTooltip(tooltip));
  window.addEventListener("resize", () => redraw());

  if (elements.statsRangeButtons) {
    elements.statsRangeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        elements.statsRangeButtons.forEach((btn) =>
          btn.classList.remove("is-active")
        );
        button.classList.add("is-active");
        load(button.dataset.statsRange);
      });
    });
  }

  const defaultButton = Array.from(elements.statsRangeButtons || []).find(
    (btn) => btn.dataset.statsRange === currentRange
  );
  if (defaultButton) defaultButton.classList.add("is-active");
  load(currentRange);
}
