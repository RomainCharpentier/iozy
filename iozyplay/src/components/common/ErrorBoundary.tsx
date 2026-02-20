import ds from '@/styles/shared/DesignSystem.module.scss'
import styles from './ErrorBoundary.module.scss'
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className={styles.root}>
          <div className={styles.content}>
            <div className={styles.icon} style={{ fontSize: '64px' }}>
              ⚠️
            </div>
            <h1 className={styles.title}>Oups ! Une erreur est survenue</h1>
            <p className={styles.message}>
              L'application a rencontré un problème inattendu.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <details className={styles.details}>
                <summary>Détails de l'erreur (développement)</summary>
                <pre className={styles.stack}>
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className={styles.actions}>
              <button className={`${ds.btn} ${ds.btnPrimary}`} onClick={this.handleReset}>
                Retour à l'accueil
              </button>
              <button className={`${ds.btn} ${ds.btnSecondary}`} onClick={() => window.location.reload()}>
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
