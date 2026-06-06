import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { MonthSelector } from "./MonthSelector"
import { YearInput } from "./YearInput"
import { BytdCheckboxes } from "./BytdCheckboxes"

export function ParametersSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parámetros para actualizar Bookmarks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MonthSelector />
          <YearInput />
        </div>
        <Separator />
        <BytdCheckboxes />
      </CardContent>
    </Card>
  )
}
