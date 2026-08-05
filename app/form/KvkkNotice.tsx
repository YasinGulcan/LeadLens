"use client";

import { useState } from "react";

/** KVKK aydınlatma metni taslağı — hukuki inceleme önerilir, ama artık placeholder içermiyor. */
export function KvkkNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-medium text-neutral-800 underline dark:text-neutral-200"
      >
        {open ? "Aydınlatma metnini gizle" : "Kişisel Verilerin Korunması Aydınlatma Metnini oku"}
      </button>

      {open && (
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            <strong>Veri Sorumlusu:</strong> LeadLens (&quot;Hizmet&quot;), iletişim:
            yasingulcan288@gmail.com.
          </p>
          <p>
            <strong>İşlenen Kişisel Veriler:</strong> Ad-soyad, telefon numarası, web sitesi adresi ve
            formda ilettiğiniz mesaj içeriği.
          </p>
          <p>
            <strong>İşleme Amaçları:</strong> Talebinizin değerlendirilmesi, size uygun ürün/hizmetin
            belirlenmesi, tarafınızla iletişime geçilmesi ve satış öncesi analiz raporunun hazırlanması.
          </p>
          <p>
            <strong>Otomatik/Yapay Zeka Destekli İşleme:</strong> Web siteniz, tarafımızca kullanılan
            yapay zeka ve web analiz araçları (İçerik analizi ve öneri modelleri) ile otomatik olarak
            değerlendirilerek size en uygun ürün/hizmet önerisi çıkarılır.
          </p>
          <p>
            <strong>Aktarım:</strong> Verileriniz, hizmet aldığımız yurt içi/yurt dışı yerleşik alt
            yükleniciler (e-posta, veritabanı, web analizi ve yapay zeka hizmet sağlayıcıları) ile
            işlemenin amacıyla sınırlı olarak paylaşılabilir. Bu kapsamda kişisel verileriniz yurt
            dışına aktarılabilir.
          </p>
          <p>
            <strong>Hukuki Sebep:</strong> KVKK m. 5/1 uyarınca açık rızanız; sözleşme öncesi
            görüşmelerin yürütülmesi ve meşru menfaat.
          </p>
          <p>
            <strong>Saklama Süresi:</strong> Talebinizin sonuçlanmasından itibaren makul bir süre
            (en fazla 2 yıl) saklanır, ardından silinir/anonimleştirilir.
          </p>
          <p>
            <strong>Haklarınız (KVKK m. 11):</strong> Verilerinizin işlenip işlenmediğini öğrenme,
            işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp
            kullanılmadığını öğrenme, yurt içi/yurt dışı aktarıldığı üçüncü kişileri bilme, eksik/yanlış
            işlenmişse düzeltilmesini isteme, silinmesini/yok edilmesini isteme ve bu işlemlerin
            aktarılan üçüncü kişilere bildirilmesini isteme haklarına sahipsiniz. Taleplerinizi
            yasingulcan288@gmail.com üzerinden iletebilirsiniz.
          </p>
        </div>
      )}
    </div>
  );
}
