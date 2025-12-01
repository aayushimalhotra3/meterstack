import { useEffect, useState } from 'react'
import { apiRequest } from '../api/client'

type EntRow = { feature_key: string; name: string; limit_value: number | null; included: boolean }

export default function EntitlementsPage() {
  const [rows, setRows] = useState<EntRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    apiRequest('/entitlements/').then((d) => setRows(d)).finally(() => setLoading(false))
  }, [])
  return (
    <div style={{ padding: 24 }}>
      <h3>Entitlements</h3>
      {loading && <div>Loading...</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Feature</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Name</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Included</th>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Limit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.feature_key}>
              <td>{r.feature_key}</td>
              <td>{r.name}</td>
              <td>{String(r.included)}</td>
              <td>{r.limit_value ?? 'unlimited'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
