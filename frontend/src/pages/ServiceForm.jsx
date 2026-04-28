import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";

const INITIAL_STATE = {
  name: "",
  url: "",
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

  useEffect(() => {
    if (isEdit) {
      api
        .get(`/services/${id}`)
        .then((res) => {
          const s = res.data;
          setForm({
            name: s.name,
            url: s.url,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload = { ...form };
    if (!payload.category) payload.category = null;
    if (!payload.status_page_url) payload.status_page_url = null;

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

    try {
      if (isEdit) {
        await api.put(`/services/${id}`, payload);
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
        <div>
          <label className={labelClass}>Name</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="GitHub"
            className={inputClass}
          />
        </div>

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

        <div>
          <label className={labelClass}>Category</label>
          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder="Dev Tools"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Status Page URL</label>
          <input
            name="status_page_url"
            value={form.status_page_url}
            onChange={handleChange}
            placeholder="https://www.githubstatus.com"
            className={inputClass}
          />
        </div>

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
