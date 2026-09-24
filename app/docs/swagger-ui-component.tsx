"use client";

import React, { useEffect, useRef, useState } from "react";
import "swagger-ui-dist/swagger-ui.css";
import { openApiSpec } from "@/lib/swagger-spec";

export default function SwaggerUIComponent() {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadSwaggerUI() {
      try {
        const SwaggerUIBundleModule = await import("swagger-ui-dist/swagger-ui-bundle");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SwaggerUIBundle = (SwaggerUIBundleModule as any).default || SwaggerUIBundleModule;

        if (isMounted && containerRef.current) {
          containerRef.current.innerHTML = "";
          SwaggerUIBundle({
            spec: openApiSpec,
            domNode: containerRef.current,
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
            ],
          });
          setLoaded(true);
        }
      } catch (err) {
        console.error("[Swagger UI] Initialization failed:", err);
        if (isMounted) {
          setError("Failed to initialize Swagger UI documentation renderer.");
        }
      }
    }

    void loadSwaggerUI();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full">
      {/* Custom Header Bar */}
      <div className="mb-8 p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 text-white rounded-2xl shadow-xl border border-rose-900/30 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="px-3 py-1 text-xs font-semibold tracking-wider text-rose-200 uppercase bg-rose-900/60 backdrop-blur rounded-full border border-rose-700/40">
              OpenAPI 3.0
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium text-amber-300 bg-amber-950/50 rounded-md border border-amber-800/40">
              v1.0.0
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Rajkamal Reader Scoring <span className="text-rose-400 font-light">API Docs</span>
          </h1>
          <p className="mt-1.5 text-sm text-slate-300 max-w-2xl leading-relaxed">
            Interactive RESTful API reference for audio transcription, reading score calculation, literary quizzes, profile management, and system health checks.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-100 bg-rose-900/50 hover:bg-rose-900/80 border border-rose-700/50 rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            OpenAPI Spec JSON
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Application
          </a>
        </div>
      </div>

      {/* Swagger UI Target Container */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden p-2 sm:p-6 min-h-[450px]">
        {!loaded && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 font-sans">
            <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-700 rounded-full animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-600">Initializing Interactive Swagger UI...</p>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 text-rose-700 font-sans">
            <p className="text-base font-semibold">{error}</p>
          </div>
        )}
        <div ref={containerRef} className={loaded ? "block" : "hidden"} />
      </div>
    </div>
  );
}
