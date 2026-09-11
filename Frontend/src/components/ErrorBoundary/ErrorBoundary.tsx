import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Red de seguridad para errores de render no atrapados por ningún
 * componente de más abajo. Sin esto, un error sin manejar deja al usuario
 * con una pantalla en blanco sin ninguna explicación.
 *
 * Tiene que ser un componente de clase: React todavía no tiene equivalente
 * en hooks para getDerivedStateFromError/componentDidCatch.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error no manejado:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h1>Ocurrió un error inesperado</h1>
          <button onClick={() => window.location.reload()}>
            Recargar la página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
