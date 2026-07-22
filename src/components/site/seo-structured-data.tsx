'use client';

import { brands, contactInfo, services } from '@/lib/data';

export default function SEOStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Energy Engine España",
    "image": "https://energyengine.es/hero.png",
    "@id": "https://energyengine.es",
    "url": "https://energyengine.es",
    "telephone": contactInfo.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "C/Miguel Lopez Bravo, 6 (Nave)",
      "addressLocality": "Yepes",
      "addressRegion": "Toledo",
      "postalCode": "45313",
      "addressCountry": "ES"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 39.9064799,
      "longitude": -3.6247125
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      "opens": "08:00",
      "closes": "18:00"
    },
    "sameAs": [
      "https://www.linkedin.com/in/energy-engine-grupos-electrogenos-74529270/?originalSubdomain=es"
    ],
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Servicios de Mantenimiento Industrial",
      "itemListElement": services.map((service) => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": service.title,
          "description": service.description
        }
      }))
    }
  };

  const brandsData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Energy Engine",
    "knowsAbout": [
      ...brands,
      "Motores Energy",
      "Sistemas de Generación de Energía",
      "Mantenimiento Multimarca Industrial"
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandsData) }}
      />
    </>
  );
}
