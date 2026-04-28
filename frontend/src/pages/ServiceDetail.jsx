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
    Promise.all([
      api.get(`/services/${id}`),
      api.get(`/services/${id}/checks?limit=1000`),
      api.get(`/incidents?service_id=${id}`),
    ])
      .then(([serviceRes, checksRes, incidentsRes]) => {
        setService(serviceRes.data);
        setChecks(checksRes.data);
        setIncidents(incidentsRes.data);
      })
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading || !service) {
    return (
      <div className="text-muted text-center py-12">Loading...</div>
    );
  }

  const status = service.current_status?.status || "unknown";
  const latency = service.current_status?.response_time;

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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <StatusDot status={status} className="w-4 h-4" />
          <h1 className="text-xl font-bold text-white">{service.name}</h1>
          {latency != null && (
            <span className="text-sm text-muted">{latency}ms</span>
          )}
        </div>
        <div className="flex gap-2">
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

      {/* Uptime Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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

      {/* Response Time Chart */}
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

      {/* Incident History */}
      <div className="bg-panel border border-edge rounded-lg">
        <div className="p-4 border-b border-edge">
          <h2 className="text-sm font-medium text-white">Incident History</h2>
        </div>
        {incidents.length === 0 ? (
          <div className="p-4 text-sm text-muted">No incidents</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left text-xs">
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Resolved</th>
                <th className="px-4 py-2 font-medium">Duration</th>
                <th className="px-4 py-2 font-medium">Checks Failed</th>
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
        )}
      </div>
    </div>
  );
}
