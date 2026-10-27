import { MapPin, Store } from 'lucide-react'
import { formatINR } from '../format.js'

export default function CurrentRetailer({ retailer }) {
  return (
    <section className="card side-card">
      <h3>Current Retailer</h3>
      <div className="retailer-card">
        <span className="avatar avatar--store" aria-hidden="true">
          <Store size={18} />
        </span>
        <div>
          <strong>{retailer.name}</strong>
          <span className="muted small">
            {retailer.ownerName} · ID {retailer.id}
          </span>
          <span className="muted small retailer-card__place">
            <MapPin size={13} aria-hidden="true" />
            {[retailer.area, retailer.city].filter(Boolean).join(', ')}
          </span>
        </div>
      </div>
      <dl className="retailer-card__stats">
        <div>
          <dt>Type</dt>
          <dd>{retailer.type}</dd>
        </div>
        <div>
          <dt>Outstanding</dt>
          <dd>{formatINR(retailer.outstandingAmount)}</dd>
        </div>
      </dl>
    </section>
  )
}
