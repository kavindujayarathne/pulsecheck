import GitHubIcon from "../assets/icons/GitHubIcon";
import GoogleIcon from "../assets/icons/GoogleIcon";

export default function Login() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      {/* Logo and tagline */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 bg-raised rounded-xl flex items-center justify-center mx-auto mb-4">
          <div className="w-6 h-6 bg-accent-light rounded-full" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">PulseCheck</h1>
        <p className="text-muted text-sm">
          Monitor the services you depend on
        </p>
      </div>

      {/* Sign in card */}
      <div className="bg-panel border border-edge rounded-lg p-8 w-full max-w-sm">
        <h2 className="text-lg font-bold text-white text-center mb-1">
          Welcome
        </h2>
        <p className="text-muted text-center text-sm mb-6">
          Sign in to your monitoring dashboard
        </p>
        <div className="flex flex-col gap-3 mb-6">
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-2 bg-raised hover:bg-edge text-white border border-edge rounded-md py-2.5 px-4 text-sm font-medium transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </a>
          <a
            href="/api/auth/github"
            className="flex items-center justify-center gap-2 bg-raised hover:bg-edge text-white border border-edge rounded-md py-2.5 px-4 text-sm font-medium transition-colors"
          >
            <GitHubIcon />
            Continue with GitHub
          </a>
        </div>

        {/* What you get */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-edge" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-panel px-3 text-xs text-muted uppercase tracking-wider">
              What you get
            </span>
          </div>
        </div>
        <ul className="flex flex-col gap-2.5 text-sm text-muted">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent-light rounded-full shrink-0" />
            Monitor any URL - APIs, websites, services
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent-light rounded-full shrink-0" />
            Real-time uptime tracking and latency charts
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent-light rounded-full shrink-0" />
            Automatic incident detection and resolution
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent-light rounded-full shrink-0" />
            Organize services by custom categories
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent-light rounded-full shrink-0" />
            Links to official status pages
          </li>
        </ul>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-muted">
        Open source &middot;{" "}
        <a
          href="https://github.com/kavindujayarathne/pulsecheck"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-light hover:underline"
        >
          GitHub
        </a>{" "}
        &middot; Self-hosted
      </p>
    </div>
  );
}
