import { STATUS_COLORS, COLORS } from "../constants/colors";

export default function UptimeBar({ days }) {
  if (!days || days.length === 0) return null;

  return (
    <div className="flex gap-[1px] sm:gap-[2px] items-end">
      {days.map((day, i) => (
        <div
          key={i}
          title={`${day.date}: ${day.status}`}
          className="flex-1 min-w-0 h-5 sm:h-7 rounded-sm"
          style={{
            backgroundColor: STATUS_COLORS[day.status] || COLORS.raised,
          }}
        />
      ))}
    </div>
  );
}
