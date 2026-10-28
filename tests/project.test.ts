import { describe, expect, it } from 'vitest';
import { ProjectController } from '../src/application/project';
import type { ScanEvent } from '../src/ports/scanner';
import type { GraphSnapshot } from '../src/core/graph';
import {
  projectRequestSchema,
  projectResponseSchema,
  workerCommandSchema,
} from '../src/contracts/project';

function setup() {
  const jobs: {
    id: string;
    canceled: boolean;
    receive: (event: ScanEvent) => void;
  }[] = [];
  let id = 0;
  const projects = new ProjectController(
    {
      start(request, receive) {
        const job = { id: request.sessionId, canceled: false, receive };
        jobs.push(job);
        return () => {
          job.canceled = true;
        };
      },
    },
    () => `session-${++id}`,
  );
  return { jobs, projects };
}
const snapshot = (sessionId: string): GraphSnapshot => ({
  sessionId,
  revision: 1,
  root: { namespace: 'test', key: 'root' },
  nodes: [
    {
      id: 'root',
      entry: {
        resource: { namespace: 'test', key: 'root' },
        relativePath: '',
        name: 'root',
        kind: 'directory',
        size: 0,
        modifiedMs: 0,
        revision: '1',
      },
      provenance: {
        provider: 'directory',
        version: '1',
        configuration: '',
        inputRevision: '1',
      },
    },
  ],
  edges: [],
  diagnostics: [],
  coverage: 'complete',
});

describe('project lifecycle', () => {
  it('rejects late scan, progress and failure events after switching roots', () => {
    const { projects, jobs } = setup();
    projects.open('first');
    projects.open('second');
    expect(jobs[0]?.canceled).toBe(true);
    const state = projects.getState();
    jobs[0]!.receive({ type: 'snapshot', snapshot: snapshot(jobs[0]!.id) });
    jobs[0]!.receive({ type: 'progress', discovered: 999 });
    jobs[0]!.receive({ type: 'failed', message: 'obsolete failure' });
    expect(projects.getState()).toBe(state);
    jobs[1]!.receive({ type: 'snapshot', snapshot: snapshot(jobs[0]!.id) });
    expect(projects.getState()).toBe(state);
    jobs[1]!.receive({ type: 'snapshot', snapshot: snapshot(jobs[1]!.id) });
    expect(projects.getState().status).toBe('scanned');
  });
  it('closing cancels work and prevents late publication', () => {
    const { projects, jobs } = setup();
    projects.open('first');
    projects.close();
    jobs[0]!.receive({ type: 'snapshot', snapshot: snapshot(jobs[0]!.id) });
    expect(jobs[0]?.canceled).toBe(true);
    expect(projects.getState()).toMatchObject({
      status: 'empty',
      sessionId: null,
      snapshot: null,
    });
  });
  it('refresh creates a new session and preserves or replaces policy', () => {
    const { projects, jobs } = setup();
    projects.open('root');
    projects.refresh({ excludedDirectoryNames: ['custom'] });
    expect(jobs[0]?.canceled).toBe(true);
    expect(projects.getState()).toMatchObject({
      rootPath: 'root',
      policy: { excludedDirectoryNames: ['custom'] },
      status: 'scanning',
    });
    projects.refresh();
    expect(projects.getState().sessionId).toBe('session-3');
    expect(projects.getState().policy.excludedDirectoryNames).toEqual([
      'custom',
    ]);
  });
  it('publishes failures and supports retry without retaining an old snapshot', () => {
    const { projects, jobs } = setup();
    projects.open('root');
    jobs[0]!.receive({ type: 'failed', message: 'access denied' });
    expect(projects.getState()).toMatchObject({
      status: 'failed',
      error: 'access denied',
      snapshot: null,
    });
    projects.refresh();
    expect(projects.getState()).toMatchObject({
      status: 'scanning',
      error: null,
    });
  });
  it('rejects invalid graph endpoints instead of partially publishing', () => {
    const { projects, jobs } = setup();
    projects.open('root');
    jobs[0]!.receive({
      type: 'snapshot',
      snapshot: {
        ...snapshot(jobs[0]!.id),
        edges: [
          {
            id: 'bad',
            kind: 'contains',
            source: 'absent',
            target: 'missing',
            provenance: {
              provider: 'test',
              version: '1',
              configuration: '',
              inputRevision: '',
            },
          },
        ],
      },
    });
    expect(projects.getState()).toMatchObject({
      status: 'failed',
      snapshot: null,
    });
  });
});

it('rejects renderer paths, unsupported schemas, arbitrary commands and malformed policies', () => {
  expect(
    projectRequestSchema.safeParse({
      schemaVersion: 1,
      command: 'open',
      path: 'C:/arbitrary',
    }).success,
  ).toBe(false);
  expect(
    projectRequestSchema.safeParse({ schemaVersion: 2, command: 'close' })
      .success,
  ).toBe(false);
  expect(
    projectRequestSchema.safeParse({ schemaVersion: 1, command: 'readFile' })
      .success,
  ).toBe(false);
  expect(
    projectRequestSchema.safeParse({
      schemaVersion: 1,
      command: 'refresh',
      policy: { excludedDirectoryNames: ['../escape'] },
    }).success,
  ).toBe(false);
  expect(
    workerCommandSchema.safeParse({
      type: 'scan',
      schemaVersion: 1,
      request: { rootPath: 'root' },
    }).success,
  ).toBe(false);
  expect(
    projectResponseSchema.safeParse({ schemaVersion: 2, state: null }).success,
  ).toBe(false);
});
