import { useState, useEffect } from "react";
import api from "../api";
import StatusDot from "../assets/icons/StatusDot";

export default function Incidents() {
  const [incidents, setIncidents] = useState([]);
  const [services, setServices] = useState([]);
  const [filters, setFilters] = useState({
    service_id: "",
    type: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/services").then((res) => setServices(res.data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.service_id) params.set("service_id", filters.service_id);
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);

    api
      .get(`/incidents?${params.toString()}`)
      .then((res) => setIncidents(res.data))
      .finally(() => setLoading(false));
  }, [filters]);

  const serviceName = (serviceId) => {
    const svc = services.find((s) => s.id === serviceId);
    return svc?.name || "Unknown";
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-6">Incidents</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={filters.service_id}
          onChange={(e) =>
            setFilters({ ...filters, service_id: e.target.value })
          }
          className="bg-panel border border-edge text-sm text-body rounded-md px-3 py-1.5"
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          className="bg-panel border border-edge text-sm text-body rounded-md px-3 py-1.5"
        >
          <option value="">All types</option>
          <option value="downtime">Downtime</option>
          <option value="degraded">Degraded</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="bg-panel border border-edge text-sm text-body rounded-md px-3 py-1.5"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Incidents Timeline */}
      {loading ? (
        <div className="text-muted text-center py-12">Loading...</div>
      ) : incidents.length === 0 ? (
        <div className="text-muted text-center py-12 text-sm">
          No incidents found
        </div>
      ) : (
        <div className="bg-panel border border-edge rounded-lg divide-y divide-edge">
          {incidents.map((incident) => {
            const started = new Date(incident.started_at);
            const resolved = incident.resolved_at
              ? new Date(incident.resolved_at)
              : null;
            const durationMs = resolved
              ? resolved - started
              : Date.now() - started;
            const durationMin = Math.round(durationMs / 60000);
            const isOpen = !resolved;

            return (
              <div key={incident.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusDot
                      status={
                        incident.type === "downtime" ? "down" : "degraded"
                      }
                    />
                    <div>
                      <span className="text-sm font-medium text-white">
                        {serviceName(incident.service_id)}
                      </span>
                      <span className="text-xs text-muted ml-2 capitalize">
                        {incident.type}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isOpen
                        ? "bg-danger-subtle text-danger"
                        : "bg-accent-subtle text-accent-light"
                    }`}
                  >
                    {isOpen ? "Open" : "Resolved"}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted flex gap-4">
                  <span>Started: {started.toLocaleString()}</span>
                  {resolved && (
                    <span>Resolved: {resolved.toLocaleString()}</span>
                  )}
                  <span>
                    Duration:{" "}
                    {durationMin < 60
                      ? `${durationMin}m`
                      : `${Math.round(durationMin / 60)}h ${durationMin % 60}m`}
                  </span>
                  <span>{incident.checks_failed} checks failed</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
