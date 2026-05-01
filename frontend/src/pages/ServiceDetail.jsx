import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import api from "../api";
import StatusDot from "../assets/icons/StatusDot";
import SafeLink from "../components/SafeLink";
import { STATUS_COLORS, COLORS } from "../constants/colors";

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [timeRange, setTimeRange] = useState("24h");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchAll = () =>
      Promise.all([
        api.get(`/services/${id}`),
        api.get(`/services/${id}/checks?limit=1000`),
        api.get(`/incidents?service_id=${id}`),
      ])
        .then(([serviceRes, checksRes, incidentsRes]) => {
          if (cancelled) return;
          setService(serviceRes.data);
          setChecks(checksRes.data);
          setIncidents(incidentsRes.data);
        })
        .catch(() => {
          if (!cancelled) navigate("/");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

    fetchAll();
    const interval = setInterval(fetchAll, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, navigate]);

  if (loading || !service) {
    return (
      <div className="text-muted text-center py-12">Loading...</div>
    );
  }

  const status = service.current_status?.status || "unknown";
  const latency = service.current_status?.response_time;
  const isStatusPage = service.monitor_type === "status_page";

  const now = new Date();
  const rangeHours = timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
  const cutoff = new Date(now.getTime() - rangeHours * 60 * 60 * 1000);
  const filteredChecks = checks
    .filter((c) => new Date(c.checked_at) >= cutoff)
    .reverse();

  const chartData = filteredChecks.map((c) => ({
    time: new Date(c.checked_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    response_time: c.response_time,
  }));

  const handleDelete = async () => {
    if (window.confirm(`Delete "${service.name}"? This cannot be undone.`)) {
      await api.delete(`/services/${id}`);
      navigate("/");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <StatusDot status={status} className="w-4 h-4" />
          <h1 className="text-xl font-bold text-white truncate">{service.name}</h1>
          {!isStatusPage && latency != null && (
            <span className="text-sm text-muted shrink-0">{latency}ms</span>
          )}
          {isStatusPage && service.component_name && (
            <span className="text-sm text-muted truncate">
              {service.component_name}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {service.status_page_url && (
            <SafeLink
              href={service.status_page_url}
              className="text-xs border border-edge px-3 py-1.5 rounded-md text-accent-light hover:border-muted"
            >
              Status Page
            </SafeLink>
          )}
          <Link
            to={`/services/${id}/edit`}
            className="text-xs border border-edge px-3 py-1.5 rounded-md text-muted hover:text-white hover:border-muted"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="text-xs border border-edge px-3 py-1.5 rounded-md text-danger hover:border-danger cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>

      {service.active_incident && (
        <div className="bg-danger/[0.06] border border-danger/40 rounded-lg p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-danger mb-1">
            Active incident {service.active_incident.impact && `· ${service.active_incident.impact}`}
          </div>
          <div className="text-sm text-white font-medium">
            {service.active_incident.name}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted">
            {service.active_incident.started_at && (
              <span>
                Started{" "}
                {new Date(service.active_incident.started_at).toLocaleString()}
              </span>
            )}
            {service.active_incident.url && (
              <SafeLink
                href={service.active_incident.url}
                className="text-accent-light hover:underline"
              >
                Provider details &#8599;
              </SafeLink>
            )}
          </div>
        </div>
      )}

      {service.active_maintenance && (
        <div className="bg-warning/[0.06] border border-warning/40 rounded-lg p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-warning mb-1">
            Scheduled maintenance · {service.active_maintenance.status}
          </div>
          <div className="text-sm text-white font-medium">
            {service.active_maintenance.name}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted">
            {service.active_maintenance.scheduled_for && (
              <span>
                From{" "}
                {new Date(service.active_maintenance.scheduled_for).toLocaleString()}
              </span>
            )}
            {service.active_maintenance.scheduled_until && (
              <span>
                Until{" "}
                {new Date(service.active_maintenance.scheduled_until).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Uptime Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
        {[
          { label: "24h", value: service.uptime?.uptime_24h },
          { label: "7d", value: service.uptime?.uptime_7d },
          { label: "30d", value: service.uptime?.uptime_30d },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-panel border border-edge rounded-lg p-4 text-center"
          >
            <div className="text-2xl font-bold text-white">
              {value != null ? `${value}%` : "-"}
            </div>
            <div className="text-xs text-muted mt-1">
              Uptime ({label})
            </div>
          </div>
        ))}
      </div>

      {/* Response Time Chart — hidden for status page monitors (no per-check latency) */}
      {!isStatusPage && (
      <div className="bg-panel border border-edge rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white">Response Time</h2>
          <div className="flex gap-1">
            {["24h", "7d", "30d"].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`text-xs px-2.5 py-1 rounded cursor-pointer ${
                  timeRange === range
                    ? "bg-edge text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.edge} />
                <XAxis
                  dataKey="time"
                  stroke={COLORS.muted}
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke={COLORS.muted}
                  fontSize={11}
                  tickLine={false}
                  unit="ms"
                />
                <Tooltip
                  contentStyle={{
                    background: COLORS.panel,
                    border: `1px solid ${COLORS.edge}`,
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: COLORS.muted }}
                />
                <Line
                  type="monotone"
                  dataKey="response_time"
                  stroke={STATUS_COLORS[status] || STATUS_COLORS.unknown}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted text-sm">
            No check data for this time range
          </div>
        )}
      </div>
      )}

      {/* Incident History */}
      <div className="bg-panel border border-edge rounded-lg">
        <div className="p-4 border-b border-edge">
          <h2 className="text-sm font-medium text-white">Incident History</h2>
        </div>
        {incidents.length === 0 ? (
          <div className="p-4 text-sm text-muted">No incidents</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-muted text-left text-xs">
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Resolved</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {incidents.map((incident) => {
                const started = new Date(incident.started_at);
                const resolved = incident.resolved_at
                  ? new Date(incident.resolved_at)
                  : null;
                const durationMs = resolved
                  ? resolved - started
                  : Date.now() - started;
                const durationMin = Math.round(durationMs / 60000);

                return (
                  <tr key={incident.id} className="text-body">
                    <td className="px-4 py-3 flex items-center gap-2">
                      <StatusDot
                        status={
                          incident.type === "downtime" ? "down" : "degraded"
                        }
                      />
                      <span className="capitalize">{incident.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      {started.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {resolved ? resolved.toLocaleString() : "Ongoing"}
                    </td>
                    <td className="px-4 py-3">
                      {durationMin < 60
                        ? `${durationMin}m`
                        : `${Math.round(durationMin / 60)}h ${durationMin % 60}m`}
                    </td>
                    <td className="px-4 py-3">{incident.checks_failed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
