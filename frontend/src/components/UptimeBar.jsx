import { STATUS_COLORS, COLORS } from "../constants/colors";

export default function UptimeBar({ days }) {
  if (!days || days.length === 0) return null;

  return (
    <div className="flex gap-[2px] items-end">
      {days.map((day, i) => (
        <div
          key={i}
          title={`${day.date}: ${day.status}`}
          className="flex-1 h-7 rounded-sm"
          style={{
            backgroundColor: STATUS_COLORS[day.status] || COLORS.raised,
          }}
        />
      ))}
    </div>
  );
}
