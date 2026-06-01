// Скелетон каталога — показывается во время загрузки серверного контента.
export default function CatalogLoading() {
  return (
    <section className="pt-[110px] pb-20" aria-busy="true" aria-label="Загрузка каталога">
      <div className="max-w-[1340px] mx-auto px-6 sm:px-10">
        <div className="mb-7">
          <div className="h-3 w-24 rounded shimmer mb-3" />
          <div className="h-9 w-80 max-w-full rounded shimmer mb-2" />
          <div className="h-4 w-48 rounded shimmer" />
        </div>
        <div className="flex flex-col lg:flex-row gap-9">
          <div className="hidden lg:block lg:w-[230px] shrink-0 space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2.5">
                <div className="h-3 w-20 rounded shimmer" />
                <div className="h-4 w-full rounded shimmer" />
                <div className="h-4 w-5/6 rounded shimmer" />
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="h-9 w-full rounded shimmer mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-white/[.08]">
                  <div className="aspect-square shimmer" />
                  <div className="p-4 space-y-2">
                    <div className="h-2.5 w-16 rounded shimmer" />
                    <div className="h-4 w-3/4 rounded shimmer" />
                    <div className="h-3 w-1/2 rounded shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
