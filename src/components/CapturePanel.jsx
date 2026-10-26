import { formatINR } from '../format.js'

const FOLLOW_UP_LABELS = {
  callback: 'Callback',
  sample_request: 'Sample request',
  credit_query: 'Credit query',
  delivery_query: 'Delivery query',
  complaint: 'Complaint',
  rep_visit: 'Rep visit',
  other: 'Other',
}

function schemeBenefit(item) {
  if (item.freeUnits > 0) return `${item.freeUnits} free`
  if (item.discountAmount > 0) return `${formatINR(item.discountAmount)} off`
  if (item.freeGift) return `${item.freeGift.quantity} × ${item.freeGift.item}`
  return '–'
}

function ItemRow({ item }) {
  return (
    <tr className={item.backorder ? 'row--backorder' : undefined}>
      <td>
        <div className="item-name">{item.productName}</div>
        <div className="item-flags">
          {item.backorder && <span className="flag flag--danger">Backorder</span>}
          {item.stockStatus === 'low_stock' && <span className="flag flag--warn">Low stock</span>}
          {item.belowMinOrder && <span className="flag flag--warn">Below min {item.minOrderQty}</span>}
        </div>
        {item.schemeHint && <div className="item-hint">{item.schemeHint}</div>}
      </td>
      <td className="num">
        {item.quantity} {item.unit}
      </td>
      <td>{schemeBenefit(item)}</td>
      <td className="num">{formatINR(item.netValue)}</td>
    </tr>
  )
}

export default function CapturePanel({ items, enquiryTotal, followUps }) {
  const hasBackorder = items.some((item) => item.backorder)

  return (
    <aside className="card capture-panel">
      <h3>Enquiry</h3>
      {items.length === 0 ? (
        <p className="muted">No products captured yet.</p>
      ) : (
        <table className="items-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Qty</th>
              <th>Scheme</th>
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ItemRow key={item.productId} item={item} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Enquiry total</td>
              <td className="num">{formatINR(enquiryTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      {hasBackorder && <p className="muted small">Backorder items are not included in the total.</p>}

      <h3>Follow-ups</h3>
      {followUps.length === 0 ? (
        <p className="muted">No follow-ups yet.</p>
      ) : (
        <ul className="follow-ups">
          {followUps.map((f) => (
            <li key={`${f.type}-${f.details}`}>
              <span className="tag">{FOLLOW_UP_LABELS[f.type] ?? f.type}</span>
              <span>{f.details}</span>
              {f.dueDate && <span className="muted small">Due {f.dueDate}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">This is an enquiry, not a confirmed order.</p>
    </aside>
  )
}
