'use client'

interface Props {
  value: number
  onChange: (val: number) => void
  placeholder?: string
  className?: string
}

export default function InputMonto({ value, onChange, placeholder = '0,00', className = '' }: Props) {
  return (
    <input
      type="number"
      min={0}
      step={0.01}
      value={value || ''}
      onChange={e => {
        const val = e.target.value
        onChange(val === '' ? 0 : parseFloat(val))
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}
