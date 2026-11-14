import { createFileRoute, redirect } from "@tanstack/react-router";

// The story book is served byte-for-byte from public/so-cot-truyen.html; / just sends visitors there.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      { name: "description", content: "Sổ cốt truyện Phủ Hách & Đại Hòa." },
      { property: "og:title", content: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      { property: "og:description", content: "Sổ cốt truyện Phủ Hách & Đại Hòa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ href: "/so-cot-truyen.html", reloadDocument: true });
  },
  component: () => null,
});
