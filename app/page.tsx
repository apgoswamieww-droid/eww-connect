export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16">
        <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-10 shadow-2xl shadow-slate-950/20">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            EWW Connect
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
            Internal collaboration for IT teams: chat, channels, meetings, and file sharing.
            This workspace is scaffolded for the MVP architecture defined in `.claude`.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-900/90 p-6 ring-1 ring-white/10">
              <p className="text-sm uppercase tracking-[0.24em] text-sky-400">Backend</p>
              <p className="mt-3 text-sm text-slate-300">Prisma schema, REST API routes, and Socket.io server.</p>
            </div>
            <div className="rounded-3xl bg-slate-900/90 p-6 ring-1 ring-white/10">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-400">Frontend</p>
              <p className="mt-3 text-sm text-slate-300">Next.js App Router homepage with starter components and styles.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
