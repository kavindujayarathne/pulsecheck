import { STATUS_COLORS } from "../../constants/colors";

export default function StatusDot({ status, className = "w-3 h-3" }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.unknown;

  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 12 12">
      <circle cx="6" cy="6" r="6" fill={color} opacity="0.3" />
      <circle cx="6" cy="6" r="4" fill={color} />
    </svg>
  );
}
