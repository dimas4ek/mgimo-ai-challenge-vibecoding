import { useMemo } from "react";
import { encode } from "uqr";

/**
 * QR-код как SVG без `innerHTML`: матрица из `uqr` (MIT), каждый тёмный модуль — квадрат в одном path.
 * Цвета не из темы: сканеры читают только тёмное на светлом, а справку печатают на белой бумаге.
 */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  /** Что закодировано — для скринридера. */
  label: string;
  className?: string;
}) {
  const { size, path } = useMemo(() => {
    // Отступ (quiet zone) 4 модуля — по стандарту, иначе телефоны хуже распознают код.
    const qr = encode(value, { ecc: "M", border: 4 });
    let d = "";
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { size: qr.size, path: d };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
