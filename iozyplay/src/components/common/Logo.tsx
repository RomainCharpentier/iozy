import '../../styles/logo.css'

interface LogoProps {
  size?: 'small' | 'medium' | 'large'
  showText?: boolean
  className?: string
}

export default function Logo({ size = 'medium', showText = true, className = '' }: LogoProps) {
  const sizeClasses = {
    small: 'logo-small',
    medium: 'logo-medium',
    large: 'logo-large'
  }

  const svgSizes = {
    small: 40,
    medium: 64,
    large: 96
  }

  const currentSize = svgSizes[size]

  return (
    <div className={`logo-container ${sizeClasses[size]} ${className}`}>
      <div className="logo-icon-wrapper">
        <img 
          src="/logo.svg" 
          alt="No Peeking Logo" 
          className="logo-img"
          style={{ width: currentSize, height: currentSize }}
          loading="lazy"
        />
      </div>
      {showText && (
        <h1 className="logo-text">
          No Peeking
        </h1>
      )}
    </div>
  )
}
