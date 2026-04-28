export default function SafeLink({ href, children, className }) {
  let safe = false;
  try {
    const url = new URL(href);
    safe = ["http:", "https:"].includes(url.protocol);
  } catch {
    safe = false;
  }

  if (!safe) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
