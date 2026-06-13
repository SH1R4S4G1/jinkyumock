import { Check } from "lucide-react";

export function CheckControl({ label, checked, onChange, disabled = false }) {
  return (
    <label className="check-control">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="checkbox-visual">
        <Check size={13} />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function EnvironmentRow({ label, available, detail }) {
  return (
    <div className="environment-row">
      <span className={`environment-dot ${available ? "available" : ""}`} />
      <strong>{label}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function RailMetric({ label, value, monospace = false }) {
  return (
    <div className="rail-metric">
      <span>{label}</span>
      <strong className={monospace ? "monospace" : ""}>{value}</strong>
    </div>
  );
}

