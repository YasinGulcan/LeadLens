import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse'ın paket bundling'i, Vercel'in production build'inde "browser"
  // export koşulunu seçip DOMMatrix (tarayıcıya özgü) kullanan web build'ini
  // getiriyordu — burada Node.js runtime'ında böyle bir global yok. Bu paketi
  // bundling dışında bırakınca native `require()` devreye giriyor, o da doğru
  // Node build'ini (pdfjs-dist/legacy) çözüyor.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
