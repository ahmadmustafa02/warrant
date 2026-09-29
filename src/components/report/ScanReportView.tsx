'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  publicScanReportSchema,
  type PublicScanReport,
} from '@/cli/scan/shareReportSchema';

type ViewState =
  { kind: 'empty' } | { kind: 'ready'; report: PublicScanReport } | { kind: 'invalid' };

function percent(rate: number | null): string {
  if (rate === null) {
    return 'n/a (nothing was exploitable)';
  }
  return `${(rate * 100).toFixed(0)}%`;
}

async function readFragment(fragment: string): Promise<PublicScanReport> {
  const padded = fragment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const text = await new Response(stream).text();
  return publicScanReportSchema.parse(JSON.parse(text));
}

export function ScanReportView() {
  const [state, setState] = useState<ViewState>({ kind: 'empty' });

  useEffect(() => {
    const load = (): void => {
      const fragment = window.location.hash.replace(/^#/, '');
      if (fragment === '') {
        setState({ kind: 'empty' });
        return;
      }
      void readFragment(fragment).then(
        (report) => {
          setState({ kind: 'ready', report });
        },
        () => {
          setState({ kind: 'invalid' });
        },
      );
    };
    load();
    window.addEventListener('hashchange', load);
    return () => {
      window.removeEventListener('hashchange', load);
    };
  }, []);

  if (state.kind === 'empty') {
    return (
      <ReportShell>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          Run <span className="font-mono">warrant scan --share</span> and open the link
          it prints. The numbers are in the link. This server does not store the scan.
        </p>
      </ReportShell>
    );
  }

  if (state.kind === 'invalid') {
    return (
      <ReportShell>
        <p className="mt-4 text-[var(--mark)]">
          This link does not contain a scan report.
        </p>
      </ReportShell>
    );
  }

  const { report } = state;
  const stop = report.summary.attackStopRate;
  const stopDetail =
    stop === null
      ? percent(null)
      : `${percent(stop)} (${report.summary.protectedCount}/${report.summary.exploitable})`;

  return (
    <ReportShell>
      <p className="mt-4 font-mono text-sm text-[var(--muted)]">{report.agent}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {report.mode} · {report.at}
      </p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <Rate label="Attack-stop" value={stopDetail} />
        <Rate
          label="Benign-pass"
          value={`${percent(report.benign.passRate)} (${report.benign.passed}/${report.benign.total})`}
        />
      </dl>
      {report.byShape.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-bold">By attack shape</h2>
          <ul className="mt-3 space-y-2 font-mono text-sm">
            {report.byShape.map((shape) => (
              <li key={shape.shape}>
                {shape.shape} ·{' '}
                {shape.attackStopRate === null
                  ? percent(null)
                  : `${percent(shape.attackStopRate)} (${shape.protectedCount}/${shape.exploitable})`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-10">
        <h2 className="text-lg font-bold">Findings</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {report.findings.map((finding) => (
            <li key={`${finding.id}-${finding.category}`}>
              <span className="font-mono">{finding.id}</span> · {finding.verdict}
              {finding.tools.length > 0 ? ` · ${finding.tools.join(', ')}` : ''}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-10">
        <h2 className="text-lg font-bold">Normal tasks</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {report.benign.tasks.map((task) => (
            <li key={task.task}>
              {task.passed ? 'pass' : 'blocked'} · {task.task}
            </li>
          ))}
        </ul>
      </section>
    </ReportShell>
  );
}

function ReportShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-16">
      <p className="text-sm font-bold text-[var(--mark)]">Scan report</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">What the guard stopped</h1>
      {children}
    </div>
  );
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-4">
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 text-2xl font-bold">{value}</dd>
    </div>
  );
}
