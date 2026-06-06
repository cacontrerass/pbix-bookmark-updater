import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EXECUTION_STEPS } from "@/lib/constants"

export function ExecutionFlow() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de ejecución</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {EXECUTION_STEPS.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <p className="pt-0.5 text-sm text-muted-foreground">{step}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
