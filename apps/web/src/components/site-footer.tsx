import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center">
                <span className="text-background text-sm font-bold">W</span>
              </div>
              <span className="text-lg font-semibold">Wardline</span>
            </div>
            <p className="text-sm text-muted-foreground">
              HIPAA-compliant voice AI platform for healthcare call centers
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground">About</Link></li>
              <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
              <li><Link href="/careers" className="hover:text-foreground">Careers</Link></li>
              <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              <li><Link href="/hipaa" className="hover:text-foreground">HIPAA BAA</Link></li>
              <li><Link href="/security" className="hover:text-foreground">Security</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between text-sm text-muted-foreground gap-4">
          <p>© 2026 Wardline Health, Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Built with Pipecat + Azure + Next.js</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
