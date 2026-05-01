import { Link } from "react-router-dom";
import StatusDot from "../assets/icons/StatusDot";
import SafeLink from "./SafeLink";
import UptimeBar from "./UptimeBar";
import { STATUS_COLORS } from "../constants/colors";

export default function ServiceCard({ service }) {
  const { current_status } = service;
  const status = current_status?.status || "unknown";
  const latency = current_status?.response_time;
  const isStatusPage = service.monitor_type === "status_page";

  const subtitle = isStatusPage
    ? service.component_name || "Status page"
    : (service.url || "").replace(/^https?:\/\//, "");

  const activeIncident = service.active_incident;
  const activeMaintenance = service.active_maintenance;

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

  const hasBar = service.uptime_30d_bar && service.uptime_30d_bar.length > 0;
  const uptimeColor = STATUS_COLORS[status] || STATUS_COLORS.unknown;

  return (
    <Link
      to={`/services/${service.id}`}
      className="block bg-panel border border-edge rounded-lg hover:border-accent-light/25 transition-colors"
    >
      <div className="px-4 sm:px-5 py-3 sm:py-4">
        {/* Top row: identity + status + (desktop) bar/uptime/latency */}
        <div className="flex items-center gap-3 sm:gap-4">
          <StatusDot status={status} />
          <div className="flex-1 min-w-0 sm:w-44 sm:flex-none">
            <div className="text-sm font-semibold text-white truncate">
              {service.name}
            </div>
            <div className="text-[11px] text-dim font-mono mt-0.5 truncate">
              {subtitle}
            </div>
          </div>
          <div className={`text-xs font-semibold sm:w-20 ${statusColor}`}>
            {statusLabel}
          </div>
          {hasBar && (
            <div className="hidden sm:block flex-1 min-w-0">
              <UptimeBar days={service.uptime_30d_bar} />
            </div>
          )}
          <div
            className="hidden sm:block text-sm font-semibold w-16 text-right"
            style={{ color: uptimeColor }}
          >
            {service.uptime_24h != null ? `${service.uptime_24h}%` : "-"}
          </div>
          {!isStatusPage && (
            <div className="hidden sm:block text-sm text-muted w-16 text-right">
              {latency != null ? `${latency}ms` : "-"}
            </div>
          )}
          <div className="hidden sm:block w-6 text-center">
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

        {/* Mobile-only second row: bar + uptime% + latency */}
        <div className="sm:hidden mt-3">
          {hasBar && <UptimeBar days={service.uptime_30d_bar} />}
          <div className="flex items-center gap-3 mt-2 text-xs">
            <span className="font-semibold" style={{ color: uptimeColor }}>
              {service.uptime_24h != null ? `${service.uptime_24h}%` : "-"}
            </span>
            {!isStatusPage && (
              <span className="text-muted">
                {latency != null ? `${latency}ms` : "-"}
              </span>
            )}
            {service.status_page_url && (
              <span
                className="ml-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <SafeLink
                  href={service.status_page_url}
                  className="text-muted hover:text-accent-light"
                >
                  Status page &#8599;
                </SafeLink>
              </span>
            )}
          </div>
        </div>
      </div>
      {activeIncident && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-edge bg-danger/[0.03] flex flex-wrap gap-x-4 gap-y-1 text-xs text-danger">
          <span className="font-medium">{activeIncident.name}</span>
          {activeIncident.impact && (
            <span className="text-muted capitalize">{activeIncident.impact}</span>
          )}
          {activeIncident.url && (
            <span onClick={(e) => e.stopPropagation()} className="ml-auto">
              <SafeLink href={activeIncident.url} className="text-danger hover:underline">
                Details &#8599;
              </SafeLink>
            </span>
          )}
        </div>
      )}
      {!activeIncident && activeMaintenance && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-edge bg-warning/[0.03] flex flex-wrap gap-x-4 gap-y-1 text-xs text-warning">
          <span className="font-medium">Maintenance: {activeMaintenance.name}</span>
          {activeMaintenance.scheduled_for && (
            <span className="text-muted">
              {new Date(activeMaintenance.scheduled_for).toLocaleString()}
            </span>
          )}
        </div>
      )}
      {!activeIncident && !activeMaintenance && status !== "up" && status !== "unknown" && current_status?.checked_at && (
        <div className="px-4 sm:px-5 py-2.5 border-t border-edge bg-danger/[0.03] flex flex-wrap gap-x-4 gap-y-1 text-xs text-danger">
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
