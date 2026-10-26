import { formatINR } from '../format.js'

export default function RetailerHeader({ retailer }) {
  return (
    <section className="card retailer-header">
      <div>
        <h2>{retailer.name}</h2>
        <p className="muted">
          {retailer.ownerName} · {retailer.city} · <span className="tag">{retailer.type}</span>
        </p>
      </div>
      <div className="retailer-header__outstanding">
        <span className="muted">Outstanding</span>
        <strong>{formatINR(retailer.outstandingAmount)}</strong>
      </div>
      {/* TODO(step 6): End Conversation button */}
    </section>
  )
}
