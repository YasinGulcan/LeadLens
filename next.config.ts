import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (PDF yükleme/ayrıştırma) Node worker_threads kullanıyor —
  // Vercel'in bundling'i bu paketi dışarıda bırakmazsa worker'ın gerçek
  // dosya yolu doğru izlenemeyip "DOMMatrix is not defined" ile çöküyordu
  // (bkz. lib/file-ingest.ts'teki "pdf-parse/worker" import'u da bunun bir
  // parçası — paketin resmi Next.js+Vercel örneğindeki kurulumla aynı).
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
