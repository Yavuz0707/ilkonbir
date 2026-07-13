import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api";

const FILTERS = [
  { id: "all", label: "Tüm Rekorlar" },
  { id: "awards", label: "Ödüller" },
  { id: "tournaments", label: "Turnuvalar" },
  { id: "clubs", label: "Kulüpler" },
  { id: "transfers", label: "Transfer" },
  { id: "ilkonbir", label: "İlkonbir Verileri" },
];

const STATUS = {
  verified: { label: "Doğrulandı", className: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200" },
  partial: { label: "Kısmen doğrulandı", className: "border-yellow-300/35 bg-yellow-300/10 text-yellow-200" },
  needs_review: { label: "Kontrol gerekiyor", className: "border-ember/45 bg-ember/10 text-ember" },
  computed: { label: "İlkonbir verisi", className: "border-cyan-300/35 bg-cyan-300/10 text-cyan-200" },
};

function statusMeta(status) {
  return STATUS[status] || STATUS.needs_review;
}

function StatusBadge({ status }) {
  if (status !== "needs_review") return null;
  const meta = statusMeta(status);
  return (
    <span className={`rounded-md border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function SourceLine({ sources = [], sourceNames = [] }) {
  const names = sources.length ? sources.map((s) => s.name) : sourceNames;
  if (!names?.length) return null;
  return <p className="mt-2 text-xs text-ink-faint">Kaynaklar: {names.filter(Boolean).join(", ")}</p>;
}

function RecordCard({ record, active, onSelect }) {
  const leader = record.leader || record.entries?.[0];
  return (
    <button
      type="button"
      onClick={() => onSelect(record)}
      className={`card-hover group flex h-full flex-col rounded-xl border p-4 text-left ${
        active ? "border-[var(--accent-line)] bg-[var(--accent-soft)]" : "border-white/10 bg-panel/55"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="eyebrow">{record.group}</span>
        <StatusBadge status={record.verification_status} />
      </div>
      <h3 className="font-display text-xl font-bold uppercase leading-tight text-ink group-hover:text-[color-mix(in_srgb,var(--accent)_82%,white)]">
        {record.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{record.description}</p>
      {leader && (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/10 bg-void/45 p-3">
          <Avatar entry={leader} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink">{leader.name}</p>
            <p className="font-mono text-sm font-semibold text-[color-mix(in_srgb,var(--accent)_82%,white)]">
              {leader.display_value}
            </p>
          </div>
        </div>
      )}
      <SourceLine sourceNames={record.source_names} />
    </button>
  );
}

function Avatar({ entry, size = "md" }) {
  const classes = size === "lg" ? "h-16 w-16 text-lg" : "h-11 w-11 text-sm";
  if (entry?.image_url) {
    return (
      <img
        src={entry.image_url}
        alt=""
        className={`${classes} shrink-0 rounded-full border border-white/10 bg-void/60 object-cover`}
      />
    );
  }
  const initials = (entry?.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <span className={`${classes} flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-void/60 font-display font-bold text-[color-mix(in_srgb,var(--accent)_82%,white)]`}>
      {initials}
    </span>
  );
}

function DetailPanel({ record }) {
  if (!record) {
    return (
      <section className="app-panel p-5 text-center text-sm text-ink-muted">
        Detayını görmek için bir rekor seç.
      </section>
    );
  }

  const entries = record.entries || [];
  const top = entries.slice(0, 5);

  return (
    <section className="app-panel p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{record.group}</p>
          <h2 className="mt-1 font-display text-3xl font-bold uppercase leading-tight text-ink">
            {record.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{record.description}</p>
          <SourceLine sources={record.sources} />
        </div>
        <StatusBadge status={record.verification_status} />
      </div>

      {top.length > 0 ? (
        <div className="grid gap-3">
          {top.map((entry, index) => (
            <article
              key={`${entry.rank}-${entry.name}`}
              className={`grid items-center gap-4 rounded-xl border p-4 sm:grid-cols-[auto_1fr_auto] ${
                index === 0
                  ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                  : "border-white/10 bg-void/45"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-10 font-display text-2xl font-bold text-[color-mix(in_srgb,var(--accent)_84%,white)]">
                  #{entry.rank}
                </span>
                <Avatar entry={entry} size={index === 0 ? "lg" : "md"} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-display text-xl font-bold uppercase text-ink">{entry.name}</h3>
                  <StatusBadge status={entry.verification_status || record.verification_status} />
                </div>
                <p className="mt-1 text-sm text-ink-muted">{entry.club_or_team || entry.country || "-"}</p>
                {entry.note && <p className="mt-2 text-xs leading-relaxed text-ink-faint">{entry.note}</p>}
              </div>
              <p className="font-mono text-2xl font-bold text-gold sm:text-right">{entry.display_value}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-void/45 p-6 text-center text-sm text-ink-muted">
          Bu rekor için gösterilecek kayıt yok.
        </p>
      )}

      {record.sources?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {record.sources.map((source) => (
            source.url ? (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/10 bg-night/45 px-3 py-2 text-xs font-semibold text-ink-muted transition hover:border-[var(--accent-line)] hover:text-ink"
              >
                {source.name}
              </a>
            ) : (
              <span key={source.name} className="rounded-lg border border-white/10 bg-night/45 px-3 py-2 text-xs font-semibold text-ink-muted">
                {source.name}
              </span>
            )
          ))}
        </div>
      )}
    </section>
  );
}

export default function StatsRecordsPage() {
  const [seedRecords, setSeedRecords] = useState([]);
  const [computedRecords, setComputedRecords] = useState([]);
  const [activeGroup, setActiveGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.records(), api.computedRecords()])
      .then(([seed, computed]) => {
        if (cancelled) return;
        const seedRows = seed.records || [];
        const computedRows = computed.records || [];
        setSeedRecords(seedRows);
        setComputedRecords(computedRows);
        setSelectedId(seedRows[0]?.id || computedRows[0]?.id || null);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Rekorlar yüklenemedi");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allSummaryRecords = useMemo(
    () => [...seedRecords, ...computedRecords.map((record) => ({ ...record, leader: record.entries?.[0], entry_count: record.entries?.length || 0, source_names: ["İlkonbir DB"] }))],
    [seedRecords, computedRecords]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    return allSummaryRecords.filter((record) => {
      const groupMatch = activeGroup === "all" || record.group_id === activeGroup;
      const queryMatch =
        !needle ||
        record.title.toLocaleLowerCase("tr").includes(needle) ||
        record.description?.toLocaleLowerCase("tr").includes(needle) ||
        record.leader?.name?.toLocaleLowerCase("tr").includes(needle);
      return groupMatch && queryMatch;
    });
  }, [activeGroup, allSummaryRecords, query]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedRecord(null);
      return;
    }
    const computed = computedRecords.find((record) => record.id === selectedId);
    if (computed) {
      setSelectedRecord(computed);
      return;
    }
    api
      .recordDetail(selectedId)
      .then(setSelectedRecord)
      .catch(() => setSelectedRecord(null));
  }, [computedRecords, selectedId]);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="theme-stats page-shell pb-20 pt-8"
    >
      <header className="page-hero mb-6 px-5 py-8 text-center">
        <span className="motif-lines" aria-hidden="true" />
        <p className="eyebrow">Futbol Rekorları Merkezi</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold uppercase tracking-normal text-ink sm:text-6xl">
          İstatistik<span className="accent-text">ler</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Oyuncular, kulüpler, ödüller ve turnuvalardan tarihi liderler. Kesin olmayan kayıtlar
          doğrulama durumuyla ayrılır; İlkonbir verileri ayrıca hesaplanır.
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveGroup(item.id)}
              className={`rounded-lg border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition ${
                activeGroup === item.id ? "segment-button-active" : "segment-button hover:border-[var(--accent-line)] hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rekor ara..."
          className="input-shell w-full rounded-xl px-4 py-3 outline-none transition lg:max-w-xs"
        />
      </div>

      {error ? (
        <section className="app-panel border-ember/50 p-6 text-center text-ember">{error}</section>
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton h-52 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.95fr)_minmax(560px,1.25fr)]">
          <section className="xl:sticky xl:top-28 xl:self-start">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold uppercase text-ink">Rekor Kategorileri</h2>
              <span className="font-mono text-xs text-ink-faint">{filtered.length} kayıt</span>
            </div>
            {filtered.length ? (
              <div className="thin-scroll grid max-h-[calc(100vh-230px)] gap-3 overflow-y-auto pr-2 md:grid-cols-2 xl:grid-cols-1">
                {filtered.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    active={selectedId === record.id}
                    onSelect={(row) => setSelectedId(row.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="app-panel p-6 text-center text-sm text-ink-muted">
                Bu filtreyle eşleşen rekor yok.
              </p>
            )}
          </section>

          <div className="xl:sticky xl:top-28 xl:self-start">
            <DetailPanel record={selectedRecord} />
          </div>
        </div>
      )}
    </motion.main>
  );
}
