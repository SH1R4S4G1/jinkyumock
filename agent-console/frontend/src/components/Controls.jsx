import { Check } from "lucide-react";

export function CheckControl({ label, checked, onChange }) {
  return (
    <label className="check-control">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox-visual">
        <Check size={13} />
      </span>
      <span>{label}</span>
    </label>
  );
}

export function RadioControl({
  label,
  description,
  checked,
  onChange,
}) {
  return (
    <label className={`radio-control ${checked ? "selected" : ""}`}>
      <input
        type="radio"
        name="execution-mode"
        checked={checked}
        onChange={onChange}
      />
      <span className="radio-dot" />
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
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

