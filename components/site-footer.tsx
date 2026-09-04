import Link from "next/link";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-gold/20 bg-np-black">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <div className="text-lg font-black text-np-cream">
              NEXT <span className="text-gold">POINT</span>
            </div>
            <p className="mt-2 text-xs uppercase tracking-widest-plus text-muted-foreground">
              Coffee Co. &mdash; Est. {site.establishedYear}
            </p>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">{site.tagline}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gold">Explore</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/shop" className="hover:text-gold">Shop Coffee</Link></li>
              <li><Link href="/fundraising" className="hover:text-gold">Team Fundraising</Link></li>
              <li><Link href="/about" className="hover:text-gold">Our Story</Link></li>
              <li><Link href="/contact" className="hover:text-gold">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gold">Get in touch</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              <a href={`mailto:${site.contactEmail}`} className="hover:text-gold">
                {site.contactEmail}
              </a>
            </p>
          </div>
        </div>

        <div className="mt-10 border-t border-gold/10 pt-6 text-center text-xs uppercase tracking-widest-plus text-muted-foreground">
          Own the Next. &copy; {new Date().getFullYear()} {site.name}
        </div>
      </div>
    </footer>
  );
}
