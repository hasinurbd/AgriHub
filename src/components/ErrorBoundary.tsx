import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected display error occurred.'
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('AgriHub ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const isBn = typeof document !== 'undefined' && document.documentElement.lang === 'bn';
      return (
        <div className="min-h-screen bg-[#f7faf8] flex items-center justify-center p-4">
          <div className="agri-card rounded-2xl max-w-md w-full p-7 shadow-lg bg-white text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <h1 className="text-lg font-bold text-slate-900">
              {isBn ? 'কিছু একটা সমস্যা হয়েছে' : 'Something went wrong'}
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isBn
                ? 'এই পৃষ্ঠাটি প্রদর্শনে সাময়িক সমস্যা হয়েছে। আপনার সেশন ও তথ্য নিরাপদ আছে।'
                : 'We encountered a temporary issue while rendering this page. Your session and data remain safe.'}
            </p>
            {this.state.errorMessage && (
              <div className="text-[11px] text-slate-600 bg-[#f7faf8] border border-[#dce7e0] rounded-lg p-2.5 break-words">
                {this.state.errorMessage}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="agri-btn agri-btn-primary"
              >
                <RefreshCw className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{isBn ? 'পুনরায় লোড করুন' : 'Reload Page'}</span>
              </button>
              <a href="/" className="agri-btn agri-btn-secondary">
                <Home className="w-4 h-4 text-[#047857] shrink-0" strokeWidth={1.75} />
                <span>{isBn ? 'হোমে ফিরুন' : 'Go to Home'}</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
