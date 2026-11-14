import { createFileRoute, redirect } from "@tanstack/react-router";

// The story book HTML stays byte-for-byte in public/; / sends visitors to /so (sign-in + cloud save wrapper).
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
    throw redirect({ to: "/so" });
  },
  component: () => null,
});
