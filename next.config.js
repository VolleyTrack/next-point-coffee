/** @type {import('next').NextConfig} */

/** Production origin of VolleyTrack/nextpoint-books. Override with BOOKS_ORIGIN. */
function booksOrigin() {
  const raw = process.env.BOOKS_ORIGIN || "https://nextpoint-books.vercel.app";
  return raw.replace(/\/+$/, "");
}

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "g.tlcdn.com",
      },
    ],
  },
  async rewrites() {
    // Multi-zone proxy for the books app (basePath /admin/books). Does not match
    // /admin/newsletter, /admin/orders, or other local /admin routes.
    const origin = booksOrigin();
    return [
      {
        source: "/admin/books",
        destination: `${origin}/admin/books`,
      },
      {
        source: "/admin/books/:path*",
        destination: `${origin}/admin/books/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
