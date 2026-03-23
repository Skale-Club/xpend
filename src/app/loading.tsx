import { Loader } from '@/components/ui/Loader';

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full">
      <Loader size={80} />
    </div>
  );
}
