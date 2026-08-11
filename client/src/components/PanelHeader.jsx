export default function PanelHeader({ icon, title, description, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div className="panel-header-icon">{icon}</div>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {description && <div className="meta" style={{ marginTop: 3 }}>{description}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}
