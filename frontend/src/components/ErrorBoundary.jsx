import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '30px', background: '#FEF2F2', color: '#991B1B', borderRadius: '12px', margin: '20px', border: '1px solid #FECACA' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 10px 0' }}>Something went wrong.</h2>
          <details open style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>Error Details</summary>
            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid #FCA5A5', color: '#B91C1C', fontFamily: 'monospace', fontSize: '13px', overflowX: 'auto', lineHeight: 1.5 }}>
              <strong>Error:</strong> {this.state.error && this.state.error.toString()}
              <br /><br />
              <strong>Component Stack:</strong>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </div>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
