export function Footer() {
  const y = new Date().getFullYear();
  return (
    <footer className="border-t border-border/80 bg-background/60 px-4 py-4 text-xs text-muted-foreground backdrop-blur-sm supports-[backdrop-filter]:bg-background/40">
      <div className="mx-auto flex max-w-[min(100%,1920px)] flex-wrap items-center justify-between gap-2">
        <span>&copy; {y} Emmanuel Aro</span>
        <span className="text-muted-foreground/70">
          Dashboard layout pattern{" "}
          <a
            href="http://www.freepik.com"
            rel="noopener noreferrer"
            target="_blank"
            className="underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground"
          >
            designed by pikisuperstar / Freepik
          </a>
        </span>
      </div>
    </footer>
  );
}
