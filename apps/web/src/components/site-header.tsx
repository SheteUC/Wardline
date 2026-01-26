import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center">
              <span className="text-background text-sm font-bold">W</span>
            </div>
            <span className="text-xl font-semibold tracking-tight">Wardline</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/contact">
              <button className="text-sm text-foreground hover:text-muted-foreground">
                Log In
              </button>
            </Link>
            <Link href="/contact">
              <button className="bg-foreground text-background px-6 py-2 rounded-full text-sm font-medium hover:bg-foreground/90">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
