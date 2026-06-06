import Image from "next/image"

export function BrandHeader() {
  return (
    <div className="mb-6">
      {/* Desktop: imagotipo completo (órbita + electrón + texto) */}
      <Image
        src="/brand/logo.png"
        alt="Data Champions"
        width={2026}
        height={596}
        className="hidden h-[73px] w-auto md:block"
        priority
      />
      {/* Móvil: logotipo solo-texto (más ancho, mejor encaje) */}
      <Image
        src="/brand/logo-text.png"
        alt="Data Champions"
        width={2133}
        height={189}
        className="block h-[47px] w-auto md:hidden"
        priority
      />
      <p className="mt-3 text-sm tracking-wide text-muted-foreground">
        Data Analytics Tools
      </p>
    </div>
  )
}
