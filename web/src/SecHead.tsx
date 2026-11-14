// numbered section header: the number, what the section is, the one question it answers
export function SecHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <header className="sec-head">
      <span className="step">{n}</span>
      <div>
        <h2 className="h-lg">{title}</h2>
        {sub && <p className="sub">{sub}</p>}
      </div>
    </header>
  )
}
