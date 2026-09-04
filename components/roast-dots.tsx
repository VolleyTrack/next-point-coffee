interface RoastDotsProps {
  level: number;
  max?: number;
}

export function RoastDots({ level, max = 5 }: RoastDotsProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={
            i < level
              ? "h-2.5 w-2.5 rounded-full bg-gold"
              : "h-2.5 w-2.5 rounded-full border border-gold/50"
          }
        />
      ))}
    </div>
  );
}
