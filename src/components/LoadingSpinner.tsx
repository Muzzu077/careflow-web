export default function LoadingSpinner({ message = 'Loading clinical data...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-10 h-10 border-4 border-[#006591]/20 border-t-[#006591] rounded-full animate-spin mb-4" />
      <p className="text-xs text-slate-500 font-semibold">{message}</p>
    </div>
  );
}
