interface StatCardProps {
  icon: string;
  iconColor?: "blue" | "green" | "red" | "yellow" | "purple";
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative";
}

export default function StatCard({
  icon,
  iconColor = "blue",
  label,
  value,
  change,
  changeType,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${iconColor}`}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {change && (
        <div className={`stat-change ${changeType ?? ""}`}>{change}</div>
      )}
    </div>
  );
}
