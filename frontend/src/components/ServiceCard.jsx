import { Link } from "react-router-dom";
import StatusDot from "../assets/icons/StatusDot";
import SafeLink from "./SafeLink";
import UptimeBar from "./UptimeBar";
import { STATUS_COLORS } from "../constants/colors";

export default function ServiceCard({ service }) {
  const { current_status } = service;
  const status = current_status?.status || "unknown";
  const latency = current_status?.response_time;

  const statusLabel =
    status === "up"
      ? "Healthy"
      : status === "degraded"
      ? "Degraded"
      : status === "down"
      ? "Down"
      : "Pending";

  const statusColor =
    status === "up"
      ? "text-accent-light"
      : status === "degraded"
      ? "text-warning"
      : status === "down"
      ? "text-danger"
      : "text-muted";

  return (
    <Link
      to={`/services/${service.id}`}
      className="block bg-panel border border-edge rounded-lg hover:border-accent-light/25 transition-colors"
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <StatusDot status={status} />
        <div className="w-44 shrink-0">
          <div className="text-sm font-semibold text-white">{service.name}</div>
          <div className="text-[11px] text-dim font-mono mt-0.5 truncate">
            {service.url.replace(/^https?:\/\//, "")}
          </div>
        </div>
        <div className={`text-xs font-semibold w-20 ${statusColor}`}>
          {statusLabel}
        </div>
        <div className="flex-1 min-w-0">
          {service.uptime_30d_bar && service.uptime_30d_bar.length > 0 && (
            <UptimeBar days={service.uptime_30d_bar} />
          )}
        </div>
        <div className="text-sm font-semibold w-16 text-right" style={{ color: STATUS_COLORS[status] || STATUS_COLORS.unknown }}>
          {service.uptime_24h != null ? `${service.uptime_24h}%` : "-"}
        </div>
        <div className="text-sm text-muted w-16 text-right">
          {latency != null ? `${latency}ms` : "-"}
        </div>
        <div className="w-6 text-center">
          {service.status_page_url && (
            <span onClick={(e) => e.stopPropagation()}>
              <SafeLink
                href={service.status_page_url}
                className="text-muted hover:text-accent-light text-sm"
              >
                &#8599;
              </SafeLink>
            </span>
          )}
        </div>
      </div>
      {status !== "up" && status !== "unknown" && current_status?.checked_at && (
        <div className="px-5 py-2.5 border-t border-edge bg-danger/[0.03] flex gap-4 text-xs text-danger">
          <span>
            <span className="text-muted">
              {status === "down" ? "Down since " : "Degraded since "}
            </span>
            {new Date(current_status.checked_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {latency != null && (
            <span>
              <span className="text-muted">Response </span>
              {latency}ms
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
