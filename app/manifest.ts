import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "نظام إدارة المساعدات الخيرية",
    short_name: "المساعدات الخيرية",
    description: "نظام ذكي لإدارة وتوزيع المساعدات الخيرية للمستفيدين",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc", // slate-50
    theme_color: "#047857", // emerald-700
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
