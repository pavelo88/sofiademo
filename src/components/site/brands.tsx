'use client';

import Image from 'next/image';
import { useState } from 'react';

interface Brand {
    name: string;
    logoUrl: string;
}

const brands: Brand[] = [

    { name: 'Atlas Copco', logoUrl: '/logos_svg/Atlas_Copco.svg' },
    { name: 'Baudouin', logoUrl: '/logos_svg/Baudouin.png' },
    { name: 'Caterpillar', logoUrl: '/logos_svg/Caterpillar.svg' },
    { name: 'Cummins', logoUrl: '/logos_svg/Cummins.svg' },
    { name: 'Deutz', logoUrl: '/logos_svg/Deutz.svg' },
    { name: 'Doosan', logoUrl: '/logos_svg/Doosan.svg' },
    { name: 'FPT', logoUrl: '/logos_svg/FPT.png' },
    { name: 'Generac', logoUrl: '/logos_svg/Generac.svg' },
    { name: 'Guascor', logoUrl: '/logos_svg/GUASCOR.png' },
    { name: 'Himoinsa', logoUrl: '/logos_svg/HIMOINSA.png' },
    { name: 'HiPower', logoUrl: '/logos_svg/HiPower50.png' },
    { name: 'Isuzu', logoUrl: '/logos_svg/Isuzu.svg' },
    { name: 'Iveco', logoUrl: '/logos_svg/Iveco.png' },
    { name: 'John Deere', logoUrl: '/logos_svg/John.png' },
    { name: 'Kohler', logoUrl: '/logos_svg/Kohler.png' },
    { name: 'Kubota', logoUrl: '/logos_svg/Kubota.png' },
    { name: 'Leroy-Somer', logoUrl: '/logos_svg/leroy-somer.png' },
    { name: 'Mecc Alte', logoUrl: '/logos_svg/Meccalte.png' },
    { name: 'Mosa', logoUrl: '/logos_svg/Mosa.png' },
    { name: 'MTU', logoUrl: '/logos_svg/MTU.svg' },
    { name: 'Perkins', logoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Perkins-Logo.svg' },
    { name: 'Pramac', logoUrl: '/logos_svg/pramac.png' },
    { name: 'Rolls Royce', logoUrl: '/logos_svg/rollsRoyce.png' },
    { name: 'Scania', logoUrl: '/logos_svg/Scania.png' },
    { name: 'Socomec', logoUrl: '/logos_svg/Socomec.svg' },
    { name: 'Stamford', logoUrl: '/logos_svg/Stamford_.png' },
    { name: 'Volvo Penta', logoUrl: '/logos_svg/volvopenta.png' },
    { name: 'Yanmar', logoUrl: '/logos_svg/Yanmar.svg' }
];

const BrandItem = ({ brand }: { brand: Brand }) => {
    const [hasError, setHasError] = useState(false);

    return (
        <div className="flex-shrink-0 w-[220px] flex items-center justify-center px-10">
            {hasError ? (
                <span className="text-sm font-headline font-black uppercase tracking-widest text-black/70 text-center">
                    {brand.name}
                </span>
            ) : (
                <div className="relative w-36 h-14 transition-all duration-500 hover:scale-110">
                    <Image
                        src={brand.logoUrl}
                        alt={`${brand.name} logo`}
                        fill
                        className="object-contain"
                        onError={() => setHasError(true)}
                        unoptimized
                    />
                </div>
            )}
        </div>
    );
};

export default function Brands() {
    const infiniteBrands = [...brands, ...brands];

    return (
        <section id="marcas" className="relative py-14 overflow-hidden scroll-mt-14">
            <div className="absolute inset-y-2 inset-x-0 bg-white/80 backdrop-blur-md border-y border-white/40 shadow-lg z-0" />

            <div className="container mx-auto px-6 mb-10 text-center max-w-5xl relative z-10">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-headline font-black text-black tracking-tighter leading-none uppercase">
                    Mantenimiento para las <br />
                    <span className="text-primary">marcas líderes del mercado</span>
                </h2>
            </div>

            <div className="relative w-full overflow-hidden flex z-10">
                <style jsx>{`
                    @keyframes slide {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .animate-slide {
                        animation: slide 75s linear infinite;
                        width: max-content;
                    }
                `}</style>

                <div className="animate-slide flex items-center py-6">
                    {infiniteBrands.map((brand, idx) => (
                        <BrandItem key={idx} brand={brand} />
                    ))}
                </div>
            </div>
        </section>
    );
}