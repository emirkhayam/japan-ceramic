// Скелетон списка коллекций (бенто-макет).
export default function CollectionsLoading() {
  return (
    <section className="pt-10 pb-24" aria-busy="true" aria-label="Загрузка коллекций">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="h-3 w-40 rounded shimmer mb-7" />
        <div className="mb-9">
          <div className="h-3 w-28 rounded shimmer mb-5" />
          <div className="h-12 w-96 max-w-full rounded shimmer mb-4" />
          <div className="h-4 w-[460px] max-w-full rounded shimmer" />
        </div>
        <div className="space-y-3 mb-12">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-9 w-24 rounded-full shimmer" />
              <div className="h-9 w-20 rounded-full shimmer" />
              <div className="h-9 w-28 rounded-full shimmer" />
            </div>
          ))}
        </div>
        {/* Герой */}
        <div className="aspect-[16/10] md:aspect-[21/9] rounded-2xl shimmer mb-7" />
        {/* Бенто-ряд */}
        <div className="grid grid-cols-12 gap-5 md:gap-7">
          <div className="col-span-12 md:col-span-7 aspect-[4/3] md:aspect-[16/10] rounded-2xl shimmer" />
          <div className="col-span-12 md:col-span-5 aspect-[4/5] rounded-2xl shimmer" />
        </div>
      </div>
    </section>
  );
}
