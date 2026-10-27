import { Droplet, Droplets, Package, Sparkles, Wheat } from 'lucide-react'

const CATEGORY_STYLES = {
  'Hair Oil': { Icon: Droplet, tone: 'hair' },
  'Edible Oil': { Icon: Droplets, tone: 'oil' },
  Skincare: { Icon: Sparkles, tone: 'skin' },
  Foods: { Icon: Wheat, tone: 'food' },
}

// Coloured category tile used instead of product images.
export default function CategoryIcon({ category }) {
  const { Icon, tone } = CATEGORY_STYLES[category] ?? { Icon: Package, tone: 'other' }
  return (
    <span className={`cat-icon cat-icon--${tone}`} title={category} aria-hidden="true">
      <Icon size={16} />
    </span>
  )
}
