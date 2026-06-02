interface LiveDotProps {
  alive?: boolean;
}

export function LiveDot({ alive = true }: LiveDotProps) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${alive ? "animate-pulse bg-green-500" : "bg-gray-400"}`}
    />
  );
}
