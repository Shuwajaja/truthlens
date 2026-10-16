import mark from "../assets/truthlens-mark.jpg";
import wordmark from "../assets/truthlens-wordmark.jpg";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "tl-brand-mark" : "tl-brand-wordmark"}>
      <img src={compact ? mark : wordmark} alt="TruthLens" />
    </span>
  );
}
