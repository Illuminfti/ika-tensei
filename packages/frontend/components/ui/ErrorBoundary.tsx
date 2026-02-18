"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import Link from "next/link";
import { IkaSprite } from "@/components/ui/PixelSprite";
import { PixelButton } from "@/components/ui/PixelButton";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      // Truncate error message to 200 characters
      const errorMessage = this.state.error?.message || "Unknown error";
      const truncatedMessage =
        errorMessage.length > 200
          ? errorMessage.substring(0, 200) + "..."
          : errorMessage;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-void-purple">
          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center gap-8 text-center px-4">
            {/* IkaSprite */}
            <IkaSprite expression="worried" />

            {/* Error title */}
            <h1 className="font-pixel text-blood-pink text-lg">
              Something went wrong...
            </h1>

            {/* Error message */}
            <p className="font-mono text-xs text-faded-spirit max-w-md break-words">
              {truncatedMessage}
            </p>

            {/* Action buttons */}
            <div className="flex gap-4">
              <PixelButton
                variant="primary"
                size="md"
                onClick={this.handleRetry}
              >
                Try Again
              </PixelButton>
              <Link href="/">
                <PixelButton variant="dark" size="md">
                  Go Home
                </PixelButton>
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
