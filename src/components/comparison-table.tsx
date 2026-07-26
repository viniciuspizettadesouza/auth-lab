import { comparisonMethods } from "@/lib/catalog";

const rows = [
  ["Initial setup", "setup"],
  ["Phishing resistance", "phishingResistance"],
  ["Replay resistance", "replayResistance"],
  ["Recovery", "recovery"]
] as const;

export function ComparisonTable() {
  return (
    <div className="comparison-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Criterion</th>
            {comparisonMethods.map((method) => (
              <th key={method.slug}>{method.shortName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, property]) => (
            <tr key={property}>
              <td>{label}</td>
              {comparisonMethods.map((method) => {
                const rating = method.ratings[property];
                return (
                  <td key={method.slug}>
                    <span className={`rating ${rating}`}>{rating}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
