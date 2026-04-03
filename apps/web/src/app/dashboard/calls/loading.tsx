import { Card } from "@/components/dashboard/shared";
import { CallsTableSkeleton } from "@/components/dashboard/skeletons";

export default function CallsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="animate-shimmer h-10 max-w-md flex-1 rounded-full" />
        <div className="flex flex-wrap gap-2">
          <div className="animate-shimmer h-8 w-14 rounded-full" />
          <div className="animate-shimmer h-8 w-24 rounded-full" />
          <div className="animate-shimmer h-8 w-24 rounded-full" />
        </div>
      </div>
      <Card className="overflow-hidden p-4 sm:p-6">
        <CallsTableSkeleton />
      </Card>
    </div>
  );
}
