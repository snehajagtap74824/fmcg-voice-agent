import { formatINR } from '../format.js'
import CategoryIcon from './CategoryIcon.jsx'

function schemeBenefit(item) {
  if (item.freeUnits > 0) return `+${item.freeUnits} free`
  if (item.discountAmount > 0) return `${formatINR(item.discountAmount)} off`
  if (item.freeGift) return `+${item.freeGift.quantity} × ${item.freeGift.item}`
  return null
}

// Live captured items as the server priced them; `products` only supplies the category for the icon.
export default function CapturedItems({ items, enquiryTotal, products }) {
  if (items.length === 0) return <p className="muted small">No products captured yet.</p>

  const categoryOf = (productId) => products.find((p) => p.id === productId)?.category

  return (
    <>
      <ul className="captured">
        {items.map((item) => {
          const benefit = schemeBenefit(item)
          return (
            <li key={item.productId} className={item.backorder ? 'captured__item captured__item--backorder' : 'captured__item'}>
              <CategoryIcon category={categoryOf(item.productId)} />
              <div className="captured__main">
                <span className="captured__name">{item.productName}</span>
                <span className="muted small">
                  Qty {item.quantity} {item.unit}
                  {benefit && <span className="captured__benefit"> · {benefit}</span>}
                </span>
                {(item.backorder || item.stockStatus === 'low_stock' || item.belowMinOrder) && (
                  <span className="item-flags">
                    {item.backorder && <span className="flag flag--danger">Backorder</span>}
                    {item.stockStatus === 'low_stock' && <span className="flag flag--warn">Low stock</span>}
                    {item.belowMinOrder && <span className="flag flag--warn">Below min {item.minOrderQty}</span>}
                  </span>
                )}
                {item.schemeHint && <span className="item-hint">{item.schemeHint}</span>}
              </div>
              <span className="captured__value">{formatINR(item.netValue)}</span>
            </li>
          )
        })}
      </ul>
      <div className="estimate">
        <span>Estimated Value</span>
        <strong>{formatINR(enquiryTotal)}</strong>
      </div>
      {items.some((item) => item.backorder) && (
        <p className="muted small">Backorder items are not included in the total.</p>
      )}
      <p className="muted small">This is an enquiry, not a confirmed order.</p>
    </>
  )
}
