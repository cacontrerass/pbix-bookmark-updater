import { BookmarkUpdater } from "@/components/BookmarkUpdater"
import { BrowserCompatibilityGate } from "@/components/BrowserCompatibilityGate"
import { AppFooter } from "@/components/AppFooter"

export default function Home() {
  return (
    <main className="min-h-screen">
      <BrowserCompatibilityGate>
        <BookmarkUpdater />
      </BrowserCompatibilityGate>
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        <AppFooter />
      </div>
    </main>
  )
}
