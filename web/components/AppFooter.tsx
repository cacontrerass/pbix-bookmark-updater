import Image from "next/image"

export function AppFooter() {
  return (
    <footer className="mt-8 border-t border-border py-6">
      <p className="text-center text-sm text-muted-foreground">
        Desarrollado por Data Champions{" "}
        <Image
          src="/brand/logotipo.png"
          alt="Data Champions"
          width={16}
          height={16}
          className="mx-1 inline-block align-middle"
        />{" "}
        (Contacto:{" "}
        <a
          href="https://www.linkedin.com/in/cacontrerassaenz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          César A. Contreras
        </a>
        )
      </p>
    </footer>
  )
}
