"use client";

import { useEffect, useState } from "react";

interface Project {
  id: string;
  name: string;
}

export default function AddToProjectButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/cabinet/projects")
        .then((r) => r.json())
        .then((data) => setProjects(data.projects || []));
    }
  }, [open]);

  async function addToProject(projectId: string) {
    setLoading(true);
    const res = await fetch(`/api/cabinet/projects/${projectId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) {
      setAdded(projectId);
      setTimeout(() => {
        setOpen(false);
        setAdded(null);
      }, 1000);
    }
    setLoading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-6 py-3 text-[13px] font-medium border border-[var(--line-2)] rounded-sm text-[var(--ink)] hover:bg-[rgba(255,255,255,.05)] hover:border-[rgba(255,255,255,.34)] transition-all duration-400"
      >
        + В проект
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--panel)] border border-[var(--line-2)] rounded-sm z-50 overflow-hidden">
          {projects.length > 0 ? (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => addToProject(p.id)}
                disabled={loading}
                className={`w-full text-left px-4 py-3 text-[13px] hover:bg-[rgba(255,255,255,.05)] transition-colors border-b border-[var(--line)] ${
                  added === p.id ? "text-green-400" : "text-[var(--ink-soft)]"
                }`}
              >
                {added === p.id ? "✓ Добавлено" : p.name}
              </button>
            ))
          ) : (
            <div className="px-4 py-4 text-[13px] text-[var(--ink-mute)]">
              Нет проектов.{" "}
              <a href="/cabinet" className="underline text-[var(--ink-soft)]">
                Создать
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
