import { OriginEntry } from '../../core/verify/types'

interface Props {
  origins: OriginEntry[]
}

export default function OriginTable({ origins }: Props) {
  if (origins.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state__icon">📭</span>
        No configuration origins found.
      </div>
    )
  }

  return (
    <div>
      <h2 className="section-title">◈ Configuration Origins</h2>
      <table className="pixel-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Origin File</th>
          </tr>
        </thead>
        <tbody>
          {origins.map((entry, i) => (
            <tr key={i}>
              <td>{entry.key}</td>
              <td>{entry.value}</td>
              <td>{entry.originFile}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
