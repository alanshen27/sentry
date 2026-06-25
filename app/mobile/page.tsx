"use client";

import dynamic from "next/dynamic";

const MobileFieldApp = dynamic(
  () => import("@/components/mobile/mobile-field-app").then((m) => m.MobileFieldApp),
  { ssr: false },
);

export default function MobilePage() {
  return <MobileFieldApp />;
}
