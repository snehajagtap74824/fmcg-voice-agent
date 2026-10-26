import { formatINR } from '../format.js'

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

// Priced items exactly as the server calculated them, with the enquiry total.
export default function ItemsTable({ items, enquiryTotal, emptyText = 'No products captured yet.' }) {
  if (items.length === 0) return <p className="muted">{emptyText}</p>

  return (
    <>
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
      {items.some((item) => item.backorder) && (
        <p className="muted small">Backorder items are not included in the total.</p>
      )}
    </>
  )
}
