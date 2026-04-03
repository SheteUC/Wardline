export default function SiteLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6">
      <div className="w-full max-w-3xl rounded-[32px] bg-[var(--background)] p-8 neo-raised">
        <div className="animate-shimmer h-6 w-32 rounded-full" />
        <div className="mt-6 space-y-4">
          <div className="animate-shimmer h-10 w-full rounded-3xl" />
          <div className="animate-shimmer h-10 w-5/6 rounded-3xl" />
          <div className="animate-shimmer h-48 w-full rounded-[32px]" />
        </div>
      </div>
    </div>
  );
}
