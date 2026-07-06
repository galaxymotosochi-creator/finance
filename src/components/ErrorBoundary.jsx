import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: "'Inter', system-ui, sans-serif",
          padding: '2rem',
          textAlign: 'center',
          background: '#f5f5f7',
          color: '#111'
        }}>
          <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🔄</div>
          <h2 style={{fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem'}}>Что-то пошло не так</h2>
          <p style={{fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem', maxWidth: '400px', lineHeight: 1.5}}>
            Произошла ошибка. Пожалуйста, обновите страницу или попробуйте позже.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              borderRadius: '100px',
              border: 'none',
              background: '#000',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '.85rem',
              fontFamily: 'inherit'
            }}
          >
            Обновить страницу
          </button>
          {this.state.error && (
            <details style={{marginTop: '1rem', fontSize: '0.7rem', color: '#999'}}>
              <summary>Технические детали</summary>
              <pre style={{marginTop: '0.5rem', textAlign: 'left', wordBreak: 'break-all', whiteSpace: 'pre-wrap'}}>{this.state.error.message}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
