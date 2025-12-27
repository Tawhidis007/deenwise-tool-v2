import React from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";

const LoginPage = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = React.useState(false);
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const savedTheme = localStorage.getItem("dw-ui-theme") || "premium";
    document.documentElement.setAttribute("data-theme", savedTheme);
    if (sessionStorage.getItem("dw-auth") === "1") {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const result = await login({ username: username.trim(), password });
      if (!result?.ok) {
        setError("Invalid credentials. Please check and try again.");
        return;
      }
      sessionStorage.setItem("dw-auth", "1");
      sessionStorage.setItem("dw-user", username.trim());
      navigate("/", { replace: true });
    } catch (err) {
      setError("Invalid credentials. Please check and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute bottom-0 left-[-10%] h-72 w-72 rounded-full bg-border/40 blur-3xl" />

      <div className="relative w-full max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">DeenWise Platform</p>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              Welcome to the DeenWise Platform
            </h1>
            <p className="text-sm md:text-base text-muted max-w-xl">
              A platform that supports structured commercial planning and execution by providing clarity across
              products, initiatives, and performance drivers.
            </p>
            <button
              className="bg-accent text-bg px-5 py-3 rounded-md font-semibold"
              onClick={() => setShowForm(true)}
            >
              Sign In
            </button>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div
              className={`w-full max-w-md bg-surface border border-border/70 rounded-xl p-6 shadow-lg transition-all duration-300 ease-out ${
                showForm ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
              }`}
            >
              <div className="mb-4">
                <div className="text-lg font-semibold">Sign in</div>
                <p className="text-sm text-muted">Enter your credentials to continue.</p>
              </div>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-sm text-muted">Username</label>
                  <input
                    className="mt-1 w-full"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted">Password</label>
                  <input
                    type="password"
                    className="mt-1 w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                {error && <div className="text-sm" style={{ color: "var(--color-returns)" }}>{error}</div>}
                <button className="w-full bg-accent text-bg px-4 py-2 rounded-md font-semibold" type="submit">
                  Continue
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
