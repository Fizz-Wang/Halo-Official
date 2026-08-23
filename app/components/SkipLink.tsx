export interface SkipLinkProps {
  targetId?: string;
  label?: "Skip to main content";
}

export function SkipLink({
  targetId = "main-content",
  label = "Skip to main content",
}: SkipLinkProps) {
  return (
    <a className="skip-link" href={`#${targetId}`}>
      {label}
    </a>
  );
}
