"use client"

import { BrandHeader } from "./BrandHeader"
import { Header } from "./Header"
import { ExecutionFlow } from "./ExecutionFlow"
import { ParametersSection } from "./ParametersSection"
import { FoldersSection } from "./FoldersSection"
import { ExecutionFooter } from "./ExecutionFooter"

export function BookmarkUpdater() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
      <BrandHeader />
      <Header />
      <ExecutionFlow />
      <ParametersSection />
      <FoldersSection />
      <ExecutionFooter />
    </div>
  )
}
