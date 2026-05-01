import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

const INITIAL_STATE = {
  name: "",
  monitor_type: "http_ping",
  url: "",
  status_page_api_urls: [],
  user_defined_urls: [],
  component_name: "",
  category: "",
  check_interval: 30,
  expected_status: 200,
  timeout_ms: 5000,
  degraded_threshold_ms: 1000,
  status_page_url: "",
};

export default function ServiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(INITIAL_STATE);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [discoverUrl, setDiscoverUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [components, setComponents] = useState([]);

  // Manual fallback: revealed only after Discover returns no components.
  // `componentsSource` tells us whether to save api_urls under the standard
  // column or the user_defined column.
  const [showManual, setShowManual] = useState(false);
  const [manualUrls, setManualUrls] = useState([""]);
  const [validating, setValidating] = useState(false);
  const [manualError, setManualError] = useState(null);
  const [componentsSource, setComponentsSource] = useState(null); // "discover" | "user_defined" | null

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/services/${id}`)
        .then((res) => {
          const s = res.data;
          setForm({
            name: s.name,
            monitor_type: s.monitor_type || "http_ping",
            url: s.url || "",
            status_page_api_urls: s.status_page_api_urls || [],
            user_defined_urls: s.user_defined_urls || [],
            component_name: s.component_name || "",
            category: s.category || "",
            check_interval: s.check_interval,
            expected_status: s.expected_status,
            timeout_ms: s.timeout_ms,
            degraded_threshold_ms: s.degraded_threshold_ms,
            status_page_url: s.status_page_url || "",
          });
        })
        .catch(() => navigate("/"));
    }
  }, [id, isEdit, navigate]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleMonitorTypeChange = (newType) => {
    setForm((prev) => ({
      ...prev,
      monitor_type: newType,
      url: newType === "http_ping" ? prev.url : "",
      status_page_api_urls: newType === "status_page" ? prev.status_page_api_urls : [],
      user_defined_urls: newType === "status_page" ? prev.user_defined_urls : [],
      component_name: newType === "status_page" ? prev.component_name : "",
    }));
    setComponents([]);
    setDiscoverUrl("");
    setDiscoverError(null);
    setShowManual(false);
    setManualUrls([""]);
    setManualError(null);
    setComponentsSource(null);
  };

  const handleDiscover = async () => {
    setDiscoverError(null);
    setManualError(null);
    setComponents([]);
    setShowManual(false);
    setComponentsSource(null);
    setForm((prev) => ({
      ...prev,
      status_page_api_urls: [],
      user_defined_urls: [],
      component_name: "",
    }));

    if (!discoverUrl.trim()) {
      setDiscoverError("Please paste a status page URL");
      return;
    }
    try {
      new URL(discoverUrl);
    } catch {
      setDiscoverError("Not a valid URL");
      return;
    }

    setDiscovering(true);
    try {
      const res = await api.post("/services/discover", { url: discoverUrl });
      const { api_urls, components: comps } = res.data;
      if (!comps || comps.length === 0) {
        setShowManual(true);
        setDiscoverError(
          "No components found via the standard endpoints. Paste known JSON URLs below."
        );
        setForm((prev) => ({ ...prev, status_page_url: discoverUrl }));
        return;
      }
      setComponents(comps);
      setComponentsSource("discover");
      setForm((prev) => ({
        ...prev,
        status_page_api_urls: api_urls,
        user_defined_urls: [],
        status_page_url: discoverUrl,
      }));
    } catch (err) {
      // 400 from discover means standard endpoints didn't work for this host;
      // surface the manual fallback instead of bouncing the user out.
      if (err.response?.status === 400) {
        setShowManual(true);
        setDiscoverError(
          "No components found via the standard endpoints. Paste known JSON URLs below."
        );
        setForm((prev) => ({ ...prev, status_page_url: discoverUrl }));
      } else {
        setDiscoverError(
          err.response?.data?.detail ||
            "Could not detect a supported status page at that URL"
        );
      }
    } finally {
      setDiscovering(false);
    }
  };

  const handleManualUrlChange = (index, value) => {
    setManualUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const handleAddManualUrl = () => {
    setManualUrls((prev) => [...prev, ""]);
  };

  const handleRemoveManualUrl = (index) => {
    setManualUrls((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const handleValidate = async () => {
    setManualError(null);
    setComponents([]);
    setComponentsSource(null);
    setForm((prev) => ({
      ...prev,
      status_page_api_urls: [],
      user_defined_urls: [],
      component_name: "",
    }));

    const trimmed = manualUrls.map((u) => u.trim()).filter(Boolean);
    if (trimmed.length === 0) {
      setManualError("Add at least one URL");
      return;
    }
    for (const u of trimmed) {
      try {
        const parsed = new URL(u);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          setManualError(`${u} must use http or https`);
          return;
        }
      } catch {
        setManualError(`${u} is not a valid URL`);
        return;
      }
    }

    setValidating(true);
    try {
      const res = await api.post("/services/validate-url", { urls: trimmed });
      const { api_urls, components: comps } = res.data;
      if (!comps || comps.length === 0) {
        setManualError("No components found in those URLs");
        return;
      }
      setComponents(comps);
      setComponentsSource("user_defined");
      setForm((prev) => ({
        ...prev,
        status_page_api_urls: [],
        user_defined_urls: api_urls,
      }));
    } catch (err) {
      setManualError(
        err.response?.data?.detail || "Could not validate those URLs"
      );
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = { ...form };
    if (!payload.category) payload.category = null;
    if (!payload.status_page_url) payload.status_page_url = null;

    if (payload.monitor_type === "http_ping") {
      payload.status_page_api_urls = null;
      payload.user_defined_urls = null;
      payload.component_name = null;
      const urlFields = ["url", "status_page_url"];
      for (const field of urlFields) {
        if (payload[field]) {
          try {
            const parsed = new URL(payload[field]);
            if (!["http:", "https:"].includes(parsed.protocol)) {
              setError(`${field} must use http or https`);
              setSubmitting(false);
              return;
            }
          } catch {
            setError(`${field} is not a valid URL`);
            setSubmitting(false);
            return;
          }
        }
      }
    } else {
      payload.url = null;

      if (componentsSource === "discover") {
        payload.user_defined_urls = null;
      } else if (componentsSource === "user_defined") {
        payload.status_page_api_urls = null;
      } else {
        payload.status_page_api_urls = null;
        payload.user_defined_urls = null;
      }

      const hasUrls =
        (payload.status_page_api_urls && payload.status_page_api_urls.length > 0) ||
        (payload.user_defined_urls && payload.user_defined_urls.length > 0);
      if (!hasUrls) {
        setError("Discover a status page and pick a component");
        setSubmitting(false);
        return;
      }
    }

    try {
      if (isEdit) {
        const editPayload = { ...payload };
        delete editPayload.monitor_type;
        delete editPayload.status_page_api_urls;
        delete editPayload.component_name;
        if (form.monitor_type === "status_page") delete editPayload.url;
        await api.put(`/services/${id}`, editPayload);
        navigate(`/services/${id}`);
      } else {
        const res = await api.post("/services", payload);
        navigate(`/services/${res.data.id}`);
      }
    } catch (err) {
      setError(
        err.response?.data?.detail?.[0]?.msg ||
          err.response?.data?.detail ||
          "Something went wrong"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-surface border border-edge text-sm text-body rounded-md px-3 py-2 focus:outline-none focus:border-accent-light";
  const labelClass = "block text-sm text-muted mb-1";

  const isHttp = form.monitor_type === "http_ping";

  const groupedComponents = (() => {
    const groups = new Map();
    const ungrouped = [];
    for (const c of components) {
      if (c.group_name) {
        if (!groups.has(c.group_name)) groups.set(c.group_name, []);
        groups.get(c.group_name).push(c);
      } else {
        ungrouped.push(c);
      }
    }
    return { groups, ungrouped };
  })();

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-white mb-6">
        {isEdit ? "Edit Service" : "Add Service"}
      </h1>

      {error && (
        <div className="bg-danger/10 border border-danger text-danger text-sm rounded-md p-3 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!isEdit && (
          <div>
            <label className={labelClass}>Monitor Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleMonitorTypeChange("http_ping")}
                className={`text-sm py-2 rounded-md border cursor-pointer ${
                  isHttp
                    ? "border-accent-light bg-accent-subtle text-accent-light"
                    : "border-edge text-muted hover:text-white"
                }`}
              >
                HTTP Ping
              </button>
              <button
                type="button"
                onClick={() => handleMonitorTypeChange("status_page")}
                className={`text-sm py-2 rounded-md border cursor-pointer ${
                  !isHttp
                    ? "border-accent-light bg-accent-subtle text-accent-light"
                    : "border-edge text-muted hover:text-white"
                }`}
              >
                Status Page
              </button>
            </div>
            <div className="text-xs text-dim mt-1">
              {isHttp
                ? "Send HTTP GET requests to a URL on an interval."
                : "Read the provider's official status JSON. No bot blocks, component-level data."}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Name</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder={isHttp ? "GitHub" : "Claude API"}
            className={inputClass}
          />
        </div>

        {isHttp ? (
          <div>
            <label className={labelClass}>URL</label>
            <input
              name="url"
              value={form.url}
              onChange={handleChange}
              required
              placeholder="https://github.com"
              className={inputClass}
            />
          </div>
        ) : isEdit ? (
          <div>
            <label className={labelClass}>Component</label>
            <input
              value={form.component_name}
              disabled
              className={`${inputClass} opacity-60`}
            />
            {(form.status_page_api_urls.length > 0 ||
              form.user_defined_urls.length > 0) && (
              <div className="text-xs text-dim mt-1 break-all">
                {(form.status_page_api_urls.length > 0
                  ? form.status_page_api_urls
                  : form.user_defined_urls
                ).join(", ")}
              </div>
            )}
          </div>
        ) : (
          <>
            <div>
              <label className={labelClass}>Status Page URL</label>
              <div className="flex gap-2">
                <input
                  value={discoverUrl}
                  onChange={(e) => setDiscoverUrl(e.target.value)}
                  placeholder="https://www.githubstatus.com"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={handleDiscover}
                  disabled={discovering}
                  className="bg-accent-light text-surface text-sm font-medium px-4 py-2 rounded-md cursor-pointer disabled:opacity-50 hover:brightness-110 whitespace-nowrap"
                >
                  {discovering ? "..." : "Discover"}
                </button>
              </div>
              <div className="text-xs text-dim mt-1">
                Paste the status page URL (e.g. status.openai.com).
              </div>
              {discoverError && (
                <div className="text-xs text-danger mt-1">{discoverError}</div>
              )}
            </div>

            {showManual && (
              <div>
                <label className={labelClass}>Manual JSON URLs</label>
                <div className="flex flex-col gap-2">
                  {manualUrls.map((u, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={u}
                        onChange={(e) => handleManualUrlChange(i, e.target.value)}
                        placeholder="https://example.com/api/status.json"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveManualUrl(i)}
                        className="border border-edge text-muted hover:text-white text-sm px-3 py-2 rounded-md cursor-pointer"
                        aria-label="Remove URL"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button
                    type="button"
                    onClick={handleAddManualUrl}
                    className="text-xs text-accent-light hover:brightness-110 cursor-pointer"
                  >
                    + add another URL
                  </button>
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={validating}
                    className="bg-accent-light text-surface text-sm font-medium px-4 py-2 rounded-md cursor-pointer disabled:opacity-50 hover:brightness-110 whitespace-nowrap"
                  >
                    {validating ? "..." : "Validate"}
                  </button>
                </div>
                <div className="text-xs text-dim mt-1">
                  Paste any JSON endpoints you know work for that status page.
                </div>
                {manualError && (
                  <div className="text-xs text-danger mt-1">{manualError}</div>
                )}
              </div>
            )}

            {components.length > 0 && (
              <div>
                <label className={labelClass}>Component</label>
                <select
                  name="component_name"
                  value={form.component_name}
                  onChange={handleChange}
                  required
                  className={inputClass}
                >
                  <option value="">Select a component...</option>
                  {groupedComponents.ungrouped.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                  {[...groupedComponents.groups.entries()].map(([group, comps]) => (
                    <optgroup key={group} label={group}>
                      {comps.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.status})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        <div>
          <label className={labelClass}>Category</label>
          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder={isHttp ? "Dev Tools" : "AI Tools"}
            className={inputClass}
          />
        </div>

        {isHttp && (
          <div>
            <label className={labelClass}>Status Page URL (optional, for display)</label>
            <input
              name="status_page_url"
              value={form.status_page_url}
              onChange={handleChange}
              placeholder="https://www.githubstatus.com"
              className={inputClass}
            />
          </div>
        )}

        {isHttp && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Check Interval (seconds)</label>
                <input
                  name="check_interval"
                  type="number"
                  value={form.check_interval}
                  onChange={handleChange}
                  min={10}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Expected Status Code</label>
                <input
                  name="expected_status"
                  type="number"
                  value={form.expected_status}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Timeout (ms)</label>
                <input
                  name="timeout_ms"
                  type="number"
                  value={form.timeout_ms}
                  onChange={handleChange}
                  min={1000}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Degraded Threshold (ms)</label>
                <input
                  name="degraded_threshold_ms"
                  type="number"
                  value={form.degraded_threshold_ms}
                  onChange={handleChange}
                  min={100}
                  className={inputClass}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 mt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-accent-light text-surface text-sm font-medium px-4 py-2 rounded-md cursor-pointer disabled:opacity-50 hover:brightness-110"
          >
            {submitting
              ? "Saving..."
              : isEdit
              ? "Update Service"
              : "Add Service"}
          </button>
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/services/${id}` : "/")}
            className="border border-edge text-muted hover:text-white text-sm px-4 py-2 rounded-md cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
