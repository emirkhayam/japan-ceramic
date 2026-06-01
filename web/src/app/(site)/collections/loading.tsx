// Скелетон списка коллекций.
export default function CollectionsLoading() {
  return (
    <section className="py-20" aria-busy="true" aria-label="Загрузка коллекций">
      <div className="max-w-[1320px] mx-auto px-10">
        <div className="mb-10">
          <div className="h-3 w-28 rounded shimmer mb-5" />
          <div className="h-12 w-96 max-w-full rounded shimmer mb-4" />
          <div className="h-4 w-[460px] max-w-full rounded shimmer" />
        </div>
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="hidden lg:block lg:w-[220px] shrink-0 space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2.5">
                <div className="h-3 w-24 rounded shimmer" />
                <div className="h-4 w-full rounded shimmer" />
                <div className="h-4 w-4/5 rounded shimmer" />
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-10">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[4/3] rounded-lg shimmer" />
                <div className="mt-4 space-y-2">
                  <div className="h-6 w-2/3 rounded shimmer" />
                  <div className="h-3 w-1/2 rounded shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
