import { comparisonMethods } from "@/lib/catalog";

const ratingColumns = [
  ["Initial setup", "setup"],
  ["Phishing resistance", "phishingResistance"],
  ["Replay resistance", "replayResistance"],
  ["Recovery", "recovery"]
] as const;

function Rating({
  value
}: {
  value: (typeof comparisonMethods)[number]["ratings"][keyof (typeof comparisonMethods)[number]["ratings"]];
}) {
  return (
    <span className={`rating ${value}`}>
      {value === "not-applicable" ? "N/A" : value}
    </span>
  );
}

export function ComparisonTable() {
  return (
    <div className="comparison-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Track</th>
            {ratingColumns.map(([label]) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparisonMethods.map((method) => (
            <tr key={method.slug}>
              <td>
                <strong className="comparison-method">{method.shortName}</strong>
                <span className="comparison-protocol">{method.protocol}</span>
              </td>
              <td>
                <span className="comparison-track">{method.tier.track}</span>
              </td>
              {ratingColumns.map(([, property]) => (
                <td key={property}>
                  <Rating value={method.ratings[property]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
