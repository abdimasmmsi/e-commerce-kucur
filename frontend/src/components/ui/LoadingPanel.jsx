import "./LoadingPanel.css";

function LoadingPanel({ label = "Loading", rows = 3, compact = false, className = "" }) {
  const count = Math.max(1, Number(rows) || 1);

  return (
    <section
      className={`loading-panel${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="loading-panel-label">{label}</span>
      <div className="loading-panel-heading" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="loading-panel-rows" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className="loading-panel-row" key={index}>
            <i />
            <span><i /><i /></span>
            <i />
          </div>
        ))}
      </div>
    </section>
  );
}

export default LoadingPanel;
