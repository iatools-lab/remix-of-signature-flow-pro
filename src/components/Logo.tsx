import fullLogo from "../../uSign_logo.png";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <img src={fullLogo} alt="Usign" className="h-10 w-auto max-w-[220px] object-contain" />
    </div>
  );
}
