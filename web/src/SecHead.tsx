// section heading as in the original design: title, optional one-line lead
export function SecHead({ title, sub }: { n?: string; title: string; sub?: string }) {
  return (
    <>
      <h2 className="h-lg">{title}</h2>
      {sub && <p className="lead narrow">{sub}</p>}
    </>
  )
}
