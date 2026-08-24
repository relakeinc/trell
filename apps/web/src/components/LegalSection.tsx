export function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-5 flex items-center gap-3">
        {number && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-sm font-medium text-neutral-500">
            {number}
          </span>
        )}
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h2>
      </div>
      <div className="space-y-4 text-[15px] leading-relaxed text-neutral-600">
        {children}
      </div>
    </section>
  );
}

export function SubSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-20">
      <h3 className="mb-3 text-base font-semibold text-neutral-900">
        <span className="font-semibold">{number}</span>{" "}
        {title}
      </h3>
      <div className="space-y-3 text-[15px] leading-relaxed text-neutral-600">
        {children}
      </div>
    </div>
  );
}
