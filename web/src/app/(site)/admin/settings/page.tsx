"use client";

import { useEffect, useState } from "react";

type Settings = {
  phone: string;
  whatsapp: string;
  telegram: string;
  instagram: string;
  email: string;
  address: string;
  hours: string;
  mapEmbedUrl: string;
  mapLink: string;
  showroomName: string;
  showroomName2: string;
  address2: string;
  mapLink2: string;
};

const EMPTY: Settings = {
  phone: "", whatsapp: "", telegram: "", instagram: "", email: "", address: "", hours: "", mapEmbedUrl: "", mapLink: "",
  showroomName: "", showroomName2: "", address2: "", mapLink2: "",
};

type FieldDef = { key: keyof Settings; label: string; placeholder: string; hint?: string; wide?: boolean };

// Группы полей формы (заголовок → поля).
const GROUPS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Связь",
    fields: [
      { key: "phone", label: "Телефон", placeholder: "+996 503 33 77 33" },
      { key: "whatsapp", label: "WhatsApp", placeholder: "996503337733", hint: "номер цифрами или ссылка wa.me" },
      { key: "telegram", label: "Telegram", placeholder: "@japanceramic", hint: "@логин или ссылка t.me/…" },
      { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/japanceramic", hint: "ссылка на профиль" },
      { key: "email", label: "Почта", placeholder: "info@japanceramic.ru" },
      { key: "hours", label: "Часы работы", placeholder: "Ежедневно · 10:00–18:00" },
    ],
  },
  {
    title: "Шоурум",
    fields: [
      { key: "showroomName", label: "Название шоурума", placeholder: "Japan Ceramic Бишкек" },
      { key: "address", label: "Адрес", placeholder: "г. Бишкек, ул. Юнусалиева, 28" },
      { key: "mapLink", label: "Ссылка 2ГИС", placeholder: "https://2gis.kg/bishkek/firm/…", hint: "из адресной строки 2ГИС — карта подставится сама + кнопка «Маршрут»", wide: true },
      { key: "mapEmbedUrl", label: "Карта 2ГИС (iframe src) — опц.", placeholder: "https://widgets.2gis.com/…", hint: "если хотите именно плитки 2ГИС: вставьте src из кода виджета 2ГИС (перекрывает авто-карту)", wide: true },
    ],
  },
  {
    title: "Второй шоурум (необязательно)",
    fields: [
      { key: "showroomName2", label: "Название", placeholder: "Japan Ceramic …" },
      { key: "address2", label: "Адрес", placeholder: "г. … , ул. …" },
      { key: "mapLink2", label: "Ссылка 2ГИС", placeholder: "https://2gis.kg/…/firm/…", hint: "карта второго шоурума", wide: true },
    ],
  },
];

export default function AdminSettingsPage() {
  const [data, setData] = useState<Settings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch("/api/admin/settings");
    if (res.ok) {
      const { settings } = await res.json();
      const next: Settings = { ...EMPTY };
      for (const k of Object.keys(EMPTY) as (keyof Settings)[]) next[k] = settings[k] ?? "";
      setData(next);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    setMsg(res.ok ? { ok: true, text: "Сохранено" } : { ok: false, text: "Не удалось сохранить" });
  }

  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  const inputClass =
    "w-full px-4 py-3 bg-[rgba(255,255,255,.04)] border border-[var(--line-2)] rounded-sm text-[var(--ink)] text-sm outline-none focus:border-[rgba(255,255,255,.34)] focus:bg-[rgba(255,255,255,.07)] transition-all placeholder:text-[var(--ink-faint)]";

  return (
    <div className="pb-12 max-w-[760px]">
      <div className="mb-8">
        <h2 className="text-[clamp(22px,2.5vw,30px)] font-extralight tracking-tight">Контакты сайта</h2>
        <p className="text-[13px] text-[var(--ink-mute)] mt-1.5">
          Эти данные показываются в футере и в блоке «Контакты» на главной.
        </p>
      </div>

      {loading ? (
        <div className="text-[var(--ink-mute)] py-10">Загрузка...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-9">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="text-[11px] font-semibold tracking-[.2em] uppercase text-[var(--ink-mute)] mb-4 pb-2 border-b border-[var(--line)]">{g.title}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {g.fields.map((f) => (
                  <div key={f.key} className={f.wide ? "md:col-span-2" : ""}>
                    <label className="block text-xs font-medium tracking-[.08em] uppercase text-[var(--ink-mute)] mb-2">
                      {f.label}
                      {f.hint && <span className="text-[var(--ink-faint)] normal-case tracking-normal lowercase"> — {f.hint}</span>}
                    </label>
                    <input type="text" value={data[f.key]} onChange={set(f.key)} placeholder={f.placeholder} className={inputClass} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4 mt-2">
            <button type="submit" disabled={saving} className="px-6 py-3 text-[13px] font-medium bg-[var(--ink)] text-[#0a0d12] rounded-sm hover:bg-white transition-all disabled:opacity-50">
              {saving ? "Сохраняю..." : "Сохранить"}
            </button>
            {msg && (
              <span className={`text-[13px] ${msg.ok ? "text-emerald-400/80" : "text-red-400/80"}`}>{msg.text}</span>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
