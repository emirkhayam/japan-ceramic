import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/cabinet", "/auth"],
    },
    sitemap: "https://japanceramic.kg/sitemap.xml",
  };
}
