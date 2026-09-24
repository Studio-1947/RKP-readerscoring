"use client";

import dynamic from "next/dynamic";

const SwaggerUIComponent = dynamic(() => import("./swagger-ui-component"), {
  ssr: false,
  loading: () => <div className="min-h-[450px]" aria-hidden="true" />,
});

export default function SwaggerUIClient() {
  return <SwaggerUIComponent />;
}
