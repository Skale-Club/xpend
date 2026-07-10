import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
        <SearchX className="h-8 w-8 text-gray-500 dark:text-gray-400" />
      </div>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
