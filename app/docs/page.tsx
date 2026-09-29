import type { Metadata } from "next";
import SwaggerUIClient from "./swagger-ui-client";
import React from "react";

export const metadata: Metadata = {
  title: "API Documentation | Rajkamal Reader Scoring",
  description: "Explore and test the official REST API endpoints for Rajkamal Reader Scoring platform.",
};

export default function ApiDocsPage() {
  return (
    <main id="api-docs-main" className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 sm:py-12 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <SwaggerUIClient />
      </div>
    </main>
  );
}
