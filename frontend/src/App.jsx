import { useState, useEffect } from "react";

function App() {
  const [apiStatus, setApiStatus] = useState("checking...");

  useEffect(() => {
    fetch(`${process.env.REACT_APP_API_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>PulseCheck</h1>
      <p>Service monitoring dashboard</p>
      <p>
        API status: <strong>{apiStatus}</strong>
      </p>
    </div>
  );
}

export default App;
