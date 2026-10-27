import { formatINR } from '../format.js'
import CategoryIcon from './CategoryIcon.jsx'

const STOCK_FLAGS = {
  out_of_stock: <span className="flag flag--danger">Out of stock</span>,
  low_stock: <span className="flag flag--warn">Low stock</span>,
}

// Read-only catalogue from /api/products, so the user can see what to ask about.
export default function ProductQuickReference({ products }) {
  return (
    <section className="card side-card">
      <h3>Product Quick Reference</h3>
      {products.length === 0 ? (
        <p className="muted small">Loading products...</p>
      ) : (
        <ul className="quick-ref">
          {products.map((p) => (
            <li key={p.id}>
              <CategoryIcon category={p.category} />
              <div className="quick-ref__main">
                <span className="quick-ref__name">{p.name}</span>
                <span className="muted small">
                  {p.packSize} {STOCK_FLAGS[p.stockStatus]}
                </span>
              </div>
              <span className="quick-ref__price">{formatINR(p.retailerPrice)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
