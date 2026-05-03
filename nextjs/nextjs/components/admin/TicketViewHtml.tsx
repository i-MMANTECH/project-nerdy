/** Renders stored ticket/comment HTML (legacy PHP stored raw HTML in DB). */
export function TicketViewHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={
        className ??
        "max-w-none border border-border bg-muted/50/80 p-4 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
