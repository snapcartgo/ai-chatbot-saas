"use client";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import WidgetClient from "./WidgetClient";

export default function WidgetPage() {
  return (
    <Suspense fallback={<div>Loading widget...</div>}>
      <WidgetClient />
    </Suspense>
  );
}