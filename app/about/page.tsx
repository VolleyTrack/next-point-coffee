import { site } from "@/lib/site";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Our Story</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream sm:text-5xl">Own the Next.</h1>

      <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground">
        <p>{site.mission}</p>
        <p>
          Every great competitor knows the same truth: you can&apos;t change the last point. The
          only point that matters is the next one. Next Point Coffee Co. was built on that idea —
          for the athletes who show up early, the leaders who set the tone, and the everyday
          competitors chasing something better than yesterday.
        </p>
        <p>
          Our first roast, <span className="font-semibold text-np-cream">First Serve</span>,
          is a medium roast built to help you start strong — balanced and smooth, with notes of
          caramel, toasted nut, and milk chocolate. It&apos;s roasted and packaged in partnership
          with {site.roaster.name} in {site.roaster.location}, in small batches.
        </p>
        <p>
          We&apos;re just getting started. Second Wind and Half Caff are brewing next, and every
          cup is part of a bigger mission: helping teams and clubs fund what matters most —
          their season.
        </p>
      </div>
    </div>
  );
}
