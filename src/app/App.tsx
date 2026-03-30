import type { ReactElement } from 'react';

export function App(): ReactElement {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Synapse</p>
        <h1>Performance-first space game foundation</h1>
        <p className="copy">
          The project shell is in place. The next layer adds the simulation,
          rendering, and world-generation boundaries that the game will grow on.
        </p>
      </section>
    </main>
  );
}
