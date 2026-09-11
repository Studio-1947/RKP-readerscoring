export type ScoreCardMetric = { label: string; value: string };

export function downloadScoreCard(input: {
  readerName: string;
  kicker: string;
  title?: string;
  totalScore: number;
  metrics: ScoreCardMetric[];
  hindi: boolean;
  filename?: string;
}) {
  const { readerName, kicker, title, totalScore, metrics, hindi, filename = "rajkamal-score-card.png" } = input;
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return;
  const centerX = size / 2;

  const background = context.createLinearGradient(0, 0, size, size);
  background.addColorStop(0, "#7e1421");
  background.addColorStop(1, "#b42332");
  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  context.fillStyle = "rgba(255,255,255,.06)";
  context.beginPath(); context.arc(size * 0.86, size * 0.12, size * 0.32, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(size * 0.08, size * 0.94, size * 0.22, 0, Math.PI * 2); context.fill();

  context.textAlign = "center";
  context.fillStyle = "#e5b043";
  context.fillRect(centerX - 45, 92, 90, 8);

  context.fillStyle = "#ffe8a7";
  context.font = "800 42px Arial";
  context.fillText(hindi ? "पढ़ाकू क्लब" : "PADHAKU CLUB", centerX, 170);

  context.fillStyle = "#ffffff";
  context.font = "900 68px Arial";
  const name = (readerName || (hindi ? "पाठक" : "Reader")).trim();
  context.fillText(name.length > 20 ? `${name.slice(0, 20)}…` : name, centerX, 275);

  context.fillStyle = "rgba(255,255,255,.85)";
  context.font = "600 30px Arial";
  context.fillText(kicker.length > 32 ? `${kicker.slice(0, 32)}…` : kicker, centerX, 325);

  if (title) {
    context.fillStyle = "rgba(255,255,255,.7)";
    context.font = "600 26px Arial";
    context.fillText(title.length > 34 ? `${title.slice(0, 34)}…` : title, centerX, 362);
  }

  context.fillStyle = "rgba(255,255,255,.7)";
  context.font = "700 28px Arial";
  context.fillText(hindi ? "कुल स्कोर" : "TOTAL SCORE", centerX, 440);

  context.fillStyle = "#ffffff";
  context.font = "900 170px Arial";
  context.fillText(`${totalScore}/100`, centerX, 630);

  const columnWidth = size / metrics.length;
  context.strokeStyle = "rgba(255,255,255,.25)";
  context.lineWidth = 2;
  for (let index = 1; index < metrics.length; index += 1) {
    const x = columnWidth * index;
    context.beginPath(); context.moveTo(x, 750); context.lineTo(x, 840); context.stroke();
  }
  metrics.forEach((metric, index) => {
    const x = columnWidth * index + columnWidth / 2;
    context.fillStyle = "#ffffff";
    context.font = "900 46px Arial";
    context.fillText(metric.value, x, 800);
    context.fillStyle = "rgba(255,255,255,.65)";
    context.font = "700 22px Arial";
    context.fillText(metric.label, x, 830);
  });

  context.fillStyle = "rgba(255,255,255,.7)";
  context.font = "700 26px Arial";
  context.fillText("WWW.DOMAINNAME.COM", centerX, size - 60);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
