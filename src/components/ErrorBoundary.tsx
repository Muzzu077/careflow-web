import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('CareFlow Error Boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
          <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-md text-center shadow-lg">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-black text-[#0b1c30] mb-2">Something Went Wrong</h2>
            <p className="text-xs text-slate-500 mb-4">
              CareFlow encountered an unexpected error. Please reload the page.
            </p>
            <p className="text-[10px] font-mono text-rose-600 bg-rose-50 p-3 rounded-lg mb-4 text-left break-all">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#006591] text-white text-xs font-bold px-6 py-2.5 rounded-lg hover:bg-[#004c6e] transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
