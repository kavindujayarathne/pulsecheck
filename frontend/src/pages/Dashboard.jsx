import { useState, useEffect } from "react";
import api from "../api";
import ServiceCard from "../components/ServiceCard";
import UptimeBar from "../components/UptimeBar";
import StatusDot from "../assets/icons/StatusDot";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [services, setServices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/services"),
      api.get("/incidents?limit=5"),
    ])
      .then(([servicesRes, incidentsRes]) => {
        setServices(servicesRes.data);
        setIncidents(incidentsRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-muted text-center py-12">Loading...</div>
    );
  }

  const operational = services.filter(
    (s) => s.current_status?.status === "up"
  ).length;
  const degraded = services.filter(
    (s) => s.current_status?.status === "degraded"
  ).length;
  const down = services.filter(
    (s) => s.current_status?.status === "down"
  ).length;
  const total = services.length;
  const allUp = operational === total && total > 0;

  const overallUptime =
    total > 0
      ? (
          services.reduce((sum, s) => sum + (s.uptime_24h ?? 100), 0) / total
        ).toFixed(1)
      : null;

  const overallBar = [];
  if (services.length > 0 && services[0].uptime_30d_bar) {
    for (let i = 0; i < 30; i++) {
      let worst = "none";
      for (const s of services) {
        const day = s.uptime_30d_bar?.[i];
        if (!day) continue;
        if (day.status === "down") { worst = "down"; break; }
        if (day.status === "degraded" && worst !== "down") worst = "degraded";
        if (day.status === "up" && worst === "none") worst = "up";
      }
      overallBar.push({
        date: services[0].uptime_30d_bar[i]?.date || "",
        status: worst,
      });
    }
  }

  const grouped = {};
  services.forEach((s) => {
    const cat = s.category || "Uncategorized";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(s);
  });

  const serviceName = (serviceId) => {
    const svc = services.find((s) => s.id === serviceId);
    return svc?.name || "Unknown";
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <Link
          to="/services/new"
          className="bg-accent-light text-surface text-sm font-semibold px-4 py-2.5 rounded-lg hover:brightness-110 transition-colors"
        >
          + Add Service
        </Link>
      </div>

      {/* Overall Status */}
      <div className="bg-panel border border-edge rounded-xl p-6 mb-7">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                allUp
                  ? "bg-accent-subtle text-accent-light"
                  : "bg-warning-subtle text-warning"
              }`}
            >
              {allUp ? "\u2713" : "\u26A0"}
            </div>
            <div>
              <div
                className={`text-lg font-semibold ${
                  allUp ? "text-accent-light" : "text-warning"
                }`}
              >
                {total === 0
                  ? "No services configured"
                  : allUp
                  ? "All Systems Operational"
                  : `${operational} of ${total} Services Operational`}
              </div>
              <div className="text-[13px] text-dim mt-0.5">
                {total > 0 && (
                  <>
                    {degraded > 0 && `${degraded} degraded`}
                    {degraded > 0 && down > 0 && " \u00B7 "}
                    {down > 0 && `${down} down`}
                    {(degraded > 0 || down > 0) && " \u00B7 "}
                    Last checked moments ago
                  </>
                )}
              </div>
            </div>
          </div>
          {overallUptime && (
            <div className="text-right">
              <div className="text-2xl font-bold text-accent-light">
                {overallUptime}%
              </div>
              <div className="text-[11px] text-dim uppercase tracking-wider">
                Overall Uptime (24h)
              </div>
            </div>
          )}
        </div>
        {overallBar.length > 0 && <UptimeBar days={overallBar} />}
      </div>

      {/* Services grouped by category */}
      {total === 0 ? (
        <div className="text-center py-12 text-muted">
          <p className="mb-2">No services yet</p>
          <Link
            to="/services/new"
            className="text-accent-light hover:underline text-sm"
          >
            Add your first service
          </Link>
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryServices]) => (
          <div key={category} className="mb-7">
            <div className="flex items-center gap-3 mb-3 px-1">
              <h2 className="text-[13px] font-semibold text-muted uppercase tracking-wider">
                {category}
              </h2>
              <span className="text-[11px] text-muted bg-raised px-2 py-0.5 rounded-full">
                {categoryServices.length} {categoryServices.length === 1 ? "service" : "services"}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {categoryServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Recent Incidents */}
      {incidents.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">
              Recent Incidents
            </h2>
            <Link
              to="/incidents"
              className="text-[13px] text-muted hover:text-accent-light"
            >
              View all &#8599;
            </Link>
          </div>
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

              const durationStr =
                durationMin < 60
                  ? `${durationMin} min`
                  : `${Math.round(durationMin / 60)}h ${durationMin % 60}m`;

              return (
                <div
                  key={incident.id}
                  className="p-4 flex items-center gap-4"
                >
                  <StatusDot
                    status={isOpen ? (incident.type === "downtime" ? "down" : "degraded") : "up"}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white">
                      {serviceName(incident.service_id)}
                      <span className="text-muted">
                        {" - "}
                        {incident.type === "downtime"
                          ? "Service Unavailable"
                          : "High Latency"}
                      </span>
                    </div>
                    <div className="text-xs text-dim mt-0.5">
                      {incident.checks_failed} checks failed
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-1 rounded ${
                      incident.type === "downtime"
                        ? "bg-danger-subtle text-danger"
                        : "bg-warning-subtle text-warning"
                    }`}
                  >
                    {incident.type === "downtime" ? "Downtime" : "Degraded"}
                  </span>
                  <div className="text-right text-xs w-20">
                    <div className="font-medium text-muted">
                      {isOpen ? "Ongoing" : durationStr}
                    </div>
                    <div className="text-dim mt-0.5">
                      {started.toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
