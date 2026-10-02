import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 bg-background">
          <Card className="max-w-md w-full p-6 text-center space-y-4 border-destructive/30 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-foreground">
                {this.props.fallbackTitle || 'Ocorreu um erro nesta secção'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Não foi possível carregar os dados desta página. Tente recarregar ou contacte o suporte.
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2 rounded bg-muted text-[11px] font-mono text-muted-foreground text-left overflow-x-auto">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                Tentar novamente
              </Button>
              <Button size="sm" onClick={this.handleReload} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Recarregar Página
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
