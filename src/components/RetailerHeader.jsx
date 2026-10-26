import { formatINR } from '../format.js'

// `children` holds the screen's actions (the End conversation button).
export default function RetailerHeader({ retailer, children }) {
  return (
    <section className="card retailer-header">
      <div>
        <h2>{retailer.name}</h2>
        <p className="muted">
          {retailer.ownerName} · {retailer.city} · <span className="tag">{retailer.type}</span>
        </p>
      </div>
      <div className="retailer-header__right">
        <div className="retailer-header__outstanding">
          <span className="muted">Outstanding</span>
          <strong>{formatINR(retailer.outstandingAmount)}</strong>
        </div>
        {children}
      </div>
    </section>
  )
}
