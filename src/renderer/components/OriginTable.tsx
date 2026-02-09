import { OriginEntry } from '../../core/verify/types'

interface Props {
  origins: OriginEntry[]
}

export default function OriginTable({ origins }: Props) {
  if (origins.length === 0) {
    return <p>No configuration origins found.</p>
  }

  return (
    <div>
      <h2>Configuration Origins</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'left' }}>Key</th>
            <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'left' }}>Value</th>
            <th style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'left' }}>Origin File</th>
          </tr>
        </thead>
        <tbody>
          {origins.map((entry, i) => (
            <tr key={i}>
              <td style={{ padding: '8px', border: '1px solid #ccc' }}>{entry.key}</td>
              <td style={{ padding: '8px', border: '1px solid #ccc' }}>{entry.value}</td>
              <td style={{ padding: '8px', border: '1px solid #ccc', fontSize: '12px' }}>
                {entry.originFile}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
